const express = require('express'),
	app = express(),
	cookie_parser = require('cookie-parser'),
	uuids = require('store'),
	fetch = (...args) =>
		import('node-fetch').then(({ default: fetch }) => fetch(...args)),
	filehandle = require('fs').promises,
	path = require('path'),
	cors = require('cors'),
	uuid_gen = (sections = 5, chars_per_sec = 4, init_end = 6) =>
		`${new Array(init_end).fill("x").join("")}-${
			new Array(sections).fill(
				new Array(chars_per_sec).fill("x").join("")
			).join("-")
		}-${new Array(init_end).fill("x").join("")}`
			.replace(/x/g, () => Math.floor(Math.random() * 64).toString(36)),
	clear = 86400000 * 7, /* 1 week(24 hours(24 * 60 * 60 * 1000) * 7) */
	themes = [
		'light',
		'dark'
	],
	prefers_scheme = require('@magica11y/prefers-color-scheme');
require('ejs');

app.use(cookie_parser());
app.use(express.static('static'));
app.set('view engine', 'ejs');
app.use(async (req, res, next) => {
	if (uuids.get(req.cookies.uuid) === undefined) res.clearCookie('uuid');
	setTimeout(next, 150);
});

app.use(async (req, res, next) => {
	if (!('theme' in req.cookies) || !themes.includes(req.cookies.theme))
		res.cookie('theme', prefers_scheme.default() === prefers_scheme.colorSchemes.DARK ? 'dark': 'light', { maxAge: 5 * 31 * 24 * 60 * 60 * 1000 * 2 });
	setTimeout(next, 150);
});

async function recheck_topics() {
	try {
		let date = new Date();
		console.log(`=> Updating all topics' information ; ${date.getMonth() + 1}(m) ${date.getDate()}, ${date.getFullYear()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`);
		data = Buffer.from(await filehandle.readFile(path.join(__dirname, 'users_data.json')), 'buffer').toString('utf-8')
		let body;
		try {
			body = JSON.parse(data);
		} catch (_) {
			console.log("=> Happened again, go restore it.")
		}
		for (let id in body) {
			for (let i = 0; i < body[id].stickies.length; i++) {
				fetch(`https://scratchdb.lefty.one/v3/forum/topic/info/${body[id].stickies[i].topic_ID}`)
					.then(e => e.json())
					.then(async e => {
						body[id].stickies[i].topic_NAME = e.title;
						body[id].stickies[i].topic_CLOSED = Boolean(e.closed);
						await filehandle.writeFile(path.join(__dirname, 'users_data.json'), JSON.stringify(body));
					})
			}
		}
	} catch (er) {
		console.log(er);
	}
}

function gobackhome(res, url = '/', time = 150) {
	setTimeout(() => res.redirect(url), time);
}

app.get('/theme_change', (req, res) => {
	res.render('themes', {
		themes: themes,
		theme: req.cookies.theme || themes[0],
		selected: themes.indexOf(req.cookies.theme) + 1 > themes.length ? 0 : themes.indexOf(req.cookies.theme) + 1
	});
})

app.get('/api/theme', (req, res) => {
	if (!('theme' in req.query) || themes.length - 1 < parseInt(req.query.theme)) {
		res.cookie('theme', themes[0], { maxAge: 5 * 31 * 24 * 60 * 60 * 1000 * 2 });
		return gobackhome(res);
	}
	res.cookie('theme', themes[parseInt(req.query.theme)], { maxAge: 5 * 31 * 24 * 60 * 60 * 1000 * 2 });
	gobackhome(res);
})

app.get('/api/auth', (req, res) => {
	if (!('privateCode' in req.query))
		return gobackhome(res);
	fetch(
		`https://auth.itinerary.eu.org/api/auth/verifyToken?privateCode=${req.query.privateCode}`
	)
		.then((s) => s.json())
		.then((d) => {
			if (!d.valid) {
				res.redirect('/');
				return;
			}
			let uuid = uuid_gen();
			uuids.set(uuid, d.username);
			res.cookie('uuid', uuid, { maxAge: clear, httpOnly: true });
			gobackhome(res);
		});
});

app.get('/logout', (req, res) => {
	uuids.remove(req.cookies.uuid);
	res.clearCookie('uuid');
	gobackhome(res);
});

app.get('/api/parseURL', (req, res) => {
	let url = new URL(req.query.url);
	url = url.pathname.split('/');
	res.redirect(`/api/add?topicId=${url[3]}`);
});

app.get('/api/add', async (req, res) => {
	try {
		let data = Buffer.from(await filehandle.readFile(path.join(__dirname, 'users_data.json'))).toString('utf-8');
		if (
			uuids.get(req.cookies.uuid) === undefined ||
			!('uuid' in req.cookies) ||
			isNaN(parseInt(req.query.topicId))
		) {
			gobackhome(res);
			return;
		}
		let body = JSON.parse(data),
			user = uuids.get(req.cookies.uuid),
			current_time = new Date();
		console.log(
			`Adding ${req.query.topicId} to ${user} at ${
				current_time.getMonth() + 1
			} ${current_time.getDate()}, ${current_time.getFullYear()}, ${current_time.getHours()}:${current_time.getMinutes()}:${current_time.getSeconds()}`
		);
		let timeout = 0;
		if (!(user.toLowerCase() in body)) {
			timeout = 1500
			fetch(`https://scratchdb.lefty.one/v3/user/info/${user}`)
				.then(s => s.json())
				.then(d => {
					body[user.toLowerCase()] = {
						user: {
							id: d.id,
							name: user,
						},
						stickies: [],
					};
				});
		}
		setTimeout(() => {
			fetch(
				`https://scratchdb.lefty.one/v3/forum/topic/posts/${req.query.topicId}/0?o=oldest`
			)
				.then(s => s.json())
				.then(async b => {
					body[user.toLowerCase()].stickies = body[
						user.toLowerCase()
					].stickies.filter((s) => s.topic_ID !== b[0].topic.id);
					body[user.toLowerCase()].stickies.push({
						topic_ID: b[0].topic.id,
						topic_NAME: b[0].topic.title,
						topic_OWNER: b[0].username,
					});
					await filehandle.writeFile(path.join(__dirname, '/users_data.json'), JSON.stringify(body));
					gobackhome(res, '/dashboard');
				})
		}, timeout)
	} catch (err) {
		console.log(err);
	}
});

app.get('/api/remove', async (req, res) => {
	try {
		let data = (await filehandle.readFile(path.join(__dirname, 'users_data.json'))).toString('utf-8')
		if (
			uuids.get(req.cookies.uuid) === undefined || !('uuid' in req.cookies)
		) {
			gobackhome(res);
			return;
		}
		let body = JSON.parse(data),
			user = uuids.get(req.cookies.uuid),
			current_time = new Date();
		console.log(
			`Removing ${parseInt(req.query.topicId)} from ${user} at ${
				current_time.getMonth() + 1
			} ${current_time.getDate()}, ${current_time.getFullYear()}, ${current_time.getHours()}:${current_time.getMinutes()}:${current_time.getSeconds()}`
		);
		body[user.toLowerCase()].stickies = body[
			user.toLowerCase()
		].stickies.filter((e) => e.topic_ID !== parseInt(req.query.topicId));
		await filehandle.writeFile(path.join(__dirname, '/users_data.json'), JSON.stringify(body));
		gobackhome(res, '/dashboard');
	} catch (err) {
		console.log(err);
	}
});

app.get('/signin', (_, res) => {
	let red = Buffer.from(
		'https://Personal-Stickies.stevesgreatness.repl.co/api/auth',
		'utf-8'
	).toString('base64');
	res.redirect(
		`https://auth.itinerary.eu.org/auth/?redirect=${red}&name=Personal%20Stickies`
	);
});

app.get('/add', (req, res) => {
	if (!('uuid' in req.cookies) || uuids.get(req.cookies.uuid) === undefined) {
		gobackhome(res);
		return;
	}
	let info = { id: null, user: null, name: null };
	if ('url' in req.query || 'topicId' in req.query) {
		let id = (req.query.topicId || req.query.url.split('/')[5]).toString();
		fetch(`https://scratchdb.lefty.one/v3/forum/topic/posts/${id}/0?o=oldest`)
			.then(e => e.json())
			.then(e => {
				let topic = e[0];
				info = {
					id: id,
					user: topic.username,
					name: topic.topic.title
				};
			})
	}
	setTimeout(() => res.render('preview', {
		theme: req.cookies.theme || themes[0],
		preview: {
			open: 'url' in req.query || 'topicId' in req.query,
			...info
		}
	}), 1000);
});

app.get('/remove', async (req, res) => {
	if (!('uuid' in req.cookies) || uuids.get(req.cookies.uuid) === undefined) {
		res.clearCookie('uuid');
		gobackhome(res);
	}
	try {
		let data = (await filehandle.readFile(path.join(__dirname, '/users_data.json'))).toString('utf-8'),
			body = JSON.parse(data),
			user = uuids.get(req.cookies.uuid);
		stickies = body[user.toLowerCase()].stickies;
		setTimeout(() => res.render('remove', { stickies: stickies, theme: req.cookies.theme || themes[0] }), 1000);
	} catch (err) {
		console.log(err);
	}
});

app.get('/', (req, res) => {
	setTimeout(() => res.render(`index`, { bool: 'uuid' in req.cookies, del: 'delete_comment' in req.query, theme: req.cookies.theme || themes[0] }), 1000);
});

app.get('/users/:user', async (req, res) => {
	try {
		let data = (await filehandle.readFile(path.join(__dirname, 'users_data.json'))).toString('utf-8'),
			body = JSON.parse(data),
			user = req.params.user;
		if (!(user.toLowerCase() in body)) {
			fetch(`https://api.scratch.mit.edu/users/${user}`)
				.then(e => e.json())
				.then(e => {
					res.render('user', {
						user: { user: { id: e.id }, stickies: [] },
						name: e.username,
						size: 16,
						theme: req.cookies.theme || themes[0]
					});
				})
				.catch(_ => {
					res.render('error', {
						code: 404,
						msg: 'User Not Found',
						desc: 'The requested user could not be found by the server.',
						theme: req.cookies.theme || themes[0]
					});
				})
			return;
		}
		user = body[user.toLowerCase()];
		let name = user.user.name,
			size = '16';
		res.render('user', { name: name, user: user, size: size, theme: req.cookies.theme || themes[0] });
	} catch (err) {
		console.log(err);
	}
});

app.get('/users/:user/bbcode', (req, res) => {
	try {
		let data = filehandle.readFile(path.join(__dirname + '/users_data.json')),
			body = JSON.parse(data),
			user = req.params.user;
		if (!(user.toLowerCase() in body)) {
			fetch(`https://api.scratch.mit.edu/users/${user}`)
				.then(e => e.json())
				.then(e => {
					res.render('bbcode', {
						user: { user: { id: e.id }, stickies: [] },
						name: e.username,
						size: 16,
						theme: req.cookies.theme || themes[0]
					});
				})
				.catch(_ => {
					res.render('error', {
						code: 404,
						msg: 'User Not Found',
						desc: 'The requested user could not be found by the server.',
						theme: req.cookies.theme || themes[0]
					});
				})
			return;
		}
		user = body[user.toLowerCase()];
		let name = user.user.name,
			size = '16';
		res.render('bbcode', { name: name, user: user, size: size,theme: req.cookies.theme || themes[0] });
	} catch (err) {
		console.log(err);
	}
});

app.get('/all_users', async (req, res) => {
	try {
		let data = (await filehandle.readFile(__dirname + '/users_data.json')).toString('utf-8'),
			body = JSON.parse(data);
		setTimeout(() => {
			res.render('all_users', { body: body, theme: req.cookies.theme || themes[0] });
		}, 100);
	} catch (err) {
		console.log(err);
	}
});

app.get('/api/user_redirect', (req, res) => {
	res.redirect(`/users/${req.query.user}`);
});

app.get('/api/users/:user', cors(), async (req, res) => {
	try {
		let data = (await filehandle.readFile(__dirname + '/users_data.json')).toString('utf-8'),
			body = JSON.parse(data),
			user = req.params.user;
		if (!(user.toLowerCase() in body)) {
			res.status(404);
			res.send({
				error: 404,
				message: 'User Not Found',
				description: 'The requested user could not be found by the server.',
				theme: req.cookies.theme || themes[0]
			});
			return;
		}
		let user_data = body[user.toLowerCase()];
		res.send(user_data);
	} catch (err) {
		console.log(err)
	}
});

app.get('/credits', async (req, res) => {
	try {
		let data = (await filehandle.readFile(path.join(__dirname, 'static', 'contributers.json'))).toString('utf-8')
		res.render('credits', { body: JSON.parse(data), theme: req.cookies.theme || themes[0] });
	} catch (err) {
		console.log(err)
	}
});

app.get('/me', (req, res) => {
	if (!('uuid' in req.cookies) || uuids.get(req.cookies.uuid) === undefined) {
		res.redirect('/');
		return;
	}
	res.redirect(`/users/${uuids.get(req.cookies.uuid)}`);
});

app.get('/me_embed', async (req, res) => {
	try {
		let data = (await filehandle.readFile(path.join(__dirname, 'users_data.json'))).toString('utf-8'),
			body = JSON.parse(data);
		if (!('uuid' in req.cookies) || uuids.get(req.cookies.uuid) === undefined) {
			res.redirect('/');
			return;
		}
		if (!(uuids.get(req.cookies.uuid).toLowerCase() in body)) {
			res.send('');
			return;
		}
		res.render('me', {
			stickies: body[uuids.get(req.cookies.uuid).toLowerCase()].stickies,
			theme: req.cookies.theme || themes[0]
		});
	} catch (err) {
		console.log(err);
	}
});

app.get('/api', (req, res) => {
	res.render('docs', { theme: req.cookies.theme || themes[0] });
});

app.get('/rearrange', (req, res) => {
	try {
		let data = filehandle.readFile(path.join(__dirname, 'users_data.json'));
		if (!('uuid' in req.cookies) || uuids.get(req.cookies.uuid) === undefined) {
			gobackhome(res);
			return;
		}
		let user = uuids.get(req.cookies.uuid),
			body = JSON.parse(data);
		user = body[user.toLowerCase()];
		let stickies = user.stickies;
		res.render('rearrange', { stickies: stickies, theme: req.cookies.theme || themes[0] });
	} catch (err) {
		console.log(err);
	}
});

app.get('/api/rearrange', async (req, res) => {
	if (!('uuid' in req.cookies) || uuids.get(req.cookies.uuid) === undefined || !('indexes' in req.query)) {
		gobackhome(res);
		return;
	}
	try {
		let data = (await filehandle.readFile(path.join(__dirname, 'users_data.json'))).toString('utf-8'),
			user = uuids.get(req.cookies.uuid),
			body = JSON.parse(data),
			indexes = req.query.indexes.split(',');
		user = body[user.toLowerCase()];
		let stickies = (user.stickies),
			final = [];
		for (let i = 0; i < stickies.length; i++) {
			let index = parseInt(indexes[i]);
			final.push(stickies[index]);
		}
		setTimeout(() => {
			body[user.user.name.toLowerCase()].stickies = final;
			filehandle.writeFile(path.join(__dirname, '/users_data.json'), JSON.stringify(body));
			gobackhome(res, '/dashboard');
		}, 1000)
	} catch (err) {
		console.log(err);
	}
});

app.get('/auth/', (req, res) => {
	res.render('auth_home', { saved: 'saved' in req.cookies, theme: req.cookies.theme || themes[0] })
})

app.get('/auth/login', (req, res) => {
	// methods: 0 = cloud, 1 = comment, 3 = profile-comment
	let method = req.query.method;
	if (!('method' in req.query) && !(method < 0 || method > 2))
		return gobackhome(res);
	fetch(`https://auth-api.itinerary.eu.org/auth/getTokens?redirect=${encodeURIComponent(Buffer.from('personal-stickies.stevesgreatness.repl.co', 'utf-8').toString('base64'))}&method=${method}${'user' in req.query ? `&username=${req.query.user}`: ''}`)
		.then(e => e.json())
		.then(e => {
			res.render('auth', {
				code: e.publicCode,
				authLoc: e.authProject || e.username,
				isuser: 'username' in e,
				private: e.privateCode,
				fullscreen: method === 0,
				theme: req.cookies.theme || themes[0]
			})
		})
})

app.get('/auth/finish', (req, res) => {
	if (!('c' in req.query)) {
		return gobackhome(res);
	}
	let save = 'save' in req.query && req.query.save == 'on'
	fetch(`https://auth-api.itinerary.eu.org/auth/verifyToken/${req.query.c}?redirect=${encodeURIComponent(Buffer.from('personal-stickies.stevesgreatness.repl.co', 'utf-8').toString('base64'))}&oneClickSignIn=${save}`)
		.then(e => e.json())
		.then(e => {
			if (!e.valid) {
				return gobackhome(res);
			}
			let uuid = uuid_gen();
			uuids.set(uuid, e.username);
			res.cookie('uuid', uuid, { maxAge: clear, httpOnly: true });
			if (save) {
				let token = e.oneClickSignInToken,
					month = 5 * 31 * 24 * 60 * 60 * 1000,
					saved = req.cookies.saved || [];
					saved.push({ token: token, user: e.username });
					res.cookie('saved', saved, { maxAge: month });
			}
			gobackhome(res, '/dashboard');
		})
})

app.get('/auth/oneclick/', (req, res) => {
	if (!('saved' in req.cookies))
		return res.render('error', {
			code: 400,
			msg: "Nothing Saved",
			desc: 'You may need to log in the old fashioned way',
			theme: req.cookies.theme || themes[0]
		})
	for (let i = 0; i < req.cookies.saved.length; i++) {
		let { token } = req.cookies.saved[i];
		fetch(`https://auth-api.itinerary.eu.org/auth/oneClickSignIn`, {
			headers: {
				Authorization: token
			}
		})
			.then(e => e.json())
			.then(e => {
				if (e.length <= 0)
					return res.cookie('saved', req.cookies.saved.filter(d => d.token !== token));
			})
	}
	setTimeout(() => res.render('oneclick', { tokens: req.cookies.saved, theme: req.cookies.theme || themes[0] }), 1000)
})

app.get('/auth/oneclick/finally', (req, res) => {
	if (
		!('saved' in req.cookies) ||
		!('index' in req.query) ||
		req.cookies.saved.length < parseInt(req.query.index) + 1
	)
		return gobackhome(res);
	fetch(`https://auth-api.itinerary.eu.org/auth/oneClickSignIn`, {
		headers: {
			Authorization: req.cookies.saved[parseInt(req.query.index)].token
		}
	})
		.then(e => e.json())
		.then(e => {
			if (e.length <= 0)
				return gobackhome(res);
			let uuid = uuid_gen();
			uuids.set(uuid, e[0].username);
			res.cookie('uuid', uuid, { maxAge: clear, httpOnly: true });
			gobackhome(res, '/dashboard');
		})
})

app.get('/dashboard', async (req, res) => {
	if (!('uuid' in req.cookies) || uuids.get(req.cookies.uuid) === undefined) {
		gobackhome(res);
		return;
	}
	let info = { id: null, user: null, name: null };
	if ('url' in req.query || 'topicId' in req.query) {
		let id = (req.query.topicId || req.query.url.split('/')[5]).toString();
		fetch(`https://scratchdb.lefty.one/v3/forum/topic/posts/${id}/0?o=oldest`)
			.then(e => e.json())
			.then(e => {
				let topic = e[0];
				info = {
					id: id,
					user: topic.username,
					name: topic.topic.title
				};
			})
	}
	try {
		let data = (await filehandle.readFile(path.join(__dirname, 'users_data.json'))).toString('utf-8'),
			body = JSON.parse(data),
			user = uuids.get(req.cookies.uuid),
			stickies = (body[user.toLowerCase()] || { stickies: [] }).stickies;
			setTimeout(() => res.render('dashboard', {
				stickies: stickies,
				theme: req.cookies.theme || themes[0],
				preview: {
					open: 'url' in req.query || 'topicId' in req.query,
					...info
				}
			}), 1000);
	} catch (err) {
		console.log(err);
	}
})

app.get('/auth/profile', (req, res) => {
	res.render('profile_auth', { theme: req.cookies.theme || themes[0] })
})

app.use((req, res, _) => {
	res.status(404);
	res.render('error', {
		theme: req.cookies.theme || themes[0],
		code: 404,
		msg: `Resource For ${req.pathname} Not Found`,
		desc: 'The requested page was not found by the server'
	});
})

app.listen(3000, async () => {
	console.log('-- Server Stats --');
	const current_time = new Date(),
		parsed_time = `${
			current_time.getMonth() + 1
		}(m) ${current_time.getDate()} ${current_time.getFullYear()} ${current_time.getHours()}:${current_time.getMinutes()}:${current_time.getSeconds()}`;
	console.log(
		`Server started: ${parsed_time}`
	);
	let data = (await filehandle.readFile(path.join(__dirname, 'users_data.json'))).toString('utf-8'),
		body = JSON.parse(data),
		users = Object.keys(body),
		contrib_path = path.join(__dirname, 'static', 'contributers.json'),
		contributers = JSON.parse((await filehandle.readFile(contrib_path)).toString('utf-8'));
	for (let i = 0; i < contributers.length; i++) {
		let contributer = contributers[i];
		if (users.includes(contributer.names.scratch.toLowerCase())) {
			contributers[i].inDB = true;
			await filehandle.writeFile(contrib_path, JSON.stringify(contributers, null, 2));
		} else {
			contributers[i].inDB = false;
			await filehandle.writeFile(contrib_path, JSON.stringify(contributers, null, 2));
		}
	}
	console.log(`There are ${users.length} user(s) in the DataBase`);
	setInterval(() => {
		let new_time = new Date(),
			parsed_new = `${
			new_time.getMonth() + 1
		}(m) ${new_time.getDate()} ${new_time.getFullYear()} ${new_time.getHours()}:${new_time.getMinutes()}:${new_time.getSeconds()}`;
		uuids.clearAll();
		console.log(`=> Clearing UUIDs from the DataBase at ${parsed_new}`)
	}, clear);
	setInterval(recheck_topics, 60000 * 15)
	recheck_topics()
});