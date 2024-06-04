import { Elysia, t } from 'elysia'
import { GenToken, checkState } from '$lib/auth'
import db from '@DB/orm'
import pushLogs from '$lib/logs'

const route = new Elysia({ prefix: '/profile/:username' })
	.get('/', async ({ params, set }) => {
		try {
			const { username } = params

			const user = await db.findUnique({
				table: 'users',
				where: { username },
				select: [
					'username',
					'name',
					'bio',
					'profile_picture',
					'banner',
					'level',
					'role',
					'points',
					'needs',
					'links',
					'verified',
					'skills',
					'languages',
					'team',
					'is_email_verified',
					'joined'
				]
			})

			if (user && user.is_email_verified) {
				return { user }
			} else {
				set.status = 404
				return { err: 'User not found' }
			}
		} catch (e) {
			set.status = 500
			console.error(`Failed to retrieve user's profile: ${e}`)
			pushLogs(`Failed to retrieve user's profile: ${e}`)
			return { err: "Something went wrong on our server, We'll try to fix it ASAP!" }
		}
	})
	.put(
		'/',
		async ({ params, body, set }) => {
			try {
				const { username } = params
				const { newUsername, password, bio, skills, languages, links, name, email } = body
				const token = checkState(body.auth, username)

				if (token?.state === 'Owner') {
					const hash = await Bun.password.hash(password, { algorithm: 'bcrypt', cost: 10 })

					await db.update({
						table: 'users',
						data: {
							username: newUsername,
							password: hash,
							name,
							bio,
							links,
							skills,
							language: languages,
							email
						},
						where: { username }
					})

					const token = GenToken({ username, password }, '365d')

					return { token }
				} else {
					set.status = 401
					return { err: 'You are not authorized to update this profile' }
				}
			} catch (e) {
				set.status = 500
				console.error(`Error updating profile: ${e}`)
				pushLogs(`Error updating profile: ${e}`)
				return { err: "Something went wrong on our server, We'll try to fix it ASAP!" }
			}
		},
		{
			params: t.Object({ username: t.String() }),
			body: t.Object({
				newUsername: t.String({
					maxLength: 25,
					error: 'Username can not be longer then 25 characters'
				}),
				email: t.String({ format: 'email', error: 'Please enter a valid email' }),
				password: t.String({
					minLength: 50,
					error: 'Password must contain 50 or more characters'
				}),
				name: t.String({ maxLength: 20, error: 'Name can not be longer than 20 characters' }),
				bio: t.String(),
				links: t.Array(t.String()),
				skills: t.Array(t.Object({ name: t.String(), level: t.String() })),
				languages: t.Array(t.Object({ name: t.String(), level: t.String() })),
				auth: t.String()
			})
		}
	)
	.delete(
		'/',
		async ({ set, body, params }) => {
			try {
				const { username } = params
				const { password } = body
				const token = await checkState(body.auth, username)

				if (token?.state === 'Owner') {
					const user = await db.findUnique({
						table: 'users',
						where: { username },
						select: ['password']
					})

					if (user) {
						const correct = await Bun.password.verify(password, user.password, 'bcrypt')
						if (correct) {
							await db.delete({
								table: 'users',
								where: { username }
							})
							set.status = 204
						} else {
							set.status = 401
							return { err: 'Wrong password' }
						}
					} else {
						set.status = 404
						return { err: `User with the username of ${username}, does not exist` }
					}
				} else {
					set.status = 401
					return { err: 'You are not authorized to delete this profile' }
				}
			} catch (e) {
				set.status = 500
				console.error(`Failed to delete profile: ${e}`)
				pushLogs(`Failed to delete profile: ${e}`)
				return { err: "Something went wrong on our server, We'll try to fix it ASAP!" }
			}
		},
		{
			params: t.Object({ username: t.String() }),
			body: t.Object({ password: t.String(), auth: t.String() })
		}
	)
	.get('/blogs', async ({ params, set }) => {
		try {
			const { username } = params

			const blogs = await db.findMany({
				tables: ['blogs'],
				where: { blogs:{ author: username }},
				select: { blogs: ['id', 'title', 'cover', 'views', 'published_at'] }
			})

			if (blogs.blogs?.length === 0) {
				return { err: `${username} hasn't uploaded any Blog Posts` }
			} else {
				return { blogs }
			}
		} catch (e) {
			set.status = 500
			console.error(`Error retrieving blogs published by user: ${e}`)
			pushLogs(`Error retrieving blogs published by user: ${e}`)
			return { err: "Something went wrong on our server, We'll try to fix it ASAP!" }
		}
	})

export default route
