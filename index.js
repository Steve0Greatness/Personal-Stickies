const express = require('express'),
	app = express(),
	cookie_parser = require('cookie-parser'),
	uuids = require('store'),
	fetch = (...args) =>
		import('node-fetch').then(({ default: fetch }) => fetch(...args)),
	fs = require('fs'),
	cors = require('cors'),
	uuid_gen = require('uuid-random'),
	clear = 86400000 * 7; /* 1 week(24 hours(24 * 60 * 60 * 1000) * 7) */
require('ejs');

var status = "";

app.use(cookie_parser());
app.use(express.static('static'));
app.set('view engine', 'ejs');
app.use(async (req, res, next) => {
	if (uuids.get(req.cookies.uuid) === undefined) res.clearCookie('uuid');
	setTimeout(next, 150);
});

function gobackhome(res, time = 150) {
	setTimeout(() => res.redirect('/'), time);
}

app.get('/api/auth', (req, res) => {
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

app.get('/api/add', (req, res) => {
	fs.readFile(__dirname + '/users_data.json', (err, data) => {
		if (err) throw err;
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
		if (!(user.toLowerCase() in body)) {
			fetch(`https://scratchdb.lefty.one/v3/user/info/${user}`)
				.then((s) => s.json())
				.then((d) => {
					body[user.toLowerCase()] = {
						user: {
							id: d.id,
							name: user,
						},
						stickies: [],
					};
					fetch(
						`https://scratchdb.lefty.one/v3/forum/topic/posts/${req.query.topicId}/0?o=oldest`
					)
						.then((s) => s.json())
						.then((b) => {
							body[user.toLowerCase()].stickies.push({
								topic_ID: b[0].topic.id,
								topic_NAME: b[0].topic.title,
								topic_OWNER: b[0].username,
							});
							fs.writeFile(
								__dirname + '/users_data.json',
								JSON.stringify(body),
								(e) => {
									if (e) throw e;
								}
							);
							gobackhome(res, 150);
						});
				});
		} else {
			fetch(
				`https://scratchdb.lefty.one/v3/forum/topic/posts/${req.query.topicId}/0?o=oldest`
			)
				.then((s) => s.json())
				.then((b) => {
					body[user.toLowerCase()].stickies = body[
						user.toLowerCase()
					].stickies.filter((s) => s.topic_ID !== b[0].topic.id);
					body[user.toLowerCase()].stickies.push({
						topic_ID: b[0].topic.id,
						topic_NAME: b[0].topic.title,
						topic_OWNER: b[0].username,
					});
					let write = new Uint8Array(Buffer.from(JSON.stringify(body)));
					fs.writeFile(__dirname + '/users_data.json', write, (e) => {
						if (e) throw e;
					});
					gobackhome(res, 150);
				});
		}
	});
});

app.get('/api/remove', (req, res) => {
	fs.readFile(__dirname + '/users_data.json', (err, data) => {
		if (err) throw err;
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
		fs.writeFile(__dirname + '/users_data.json', JSON.stringify(body), (err) => {
			if (err) throw err;
		});
		gobackhome(res);
	});
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
	setTimeout(() => res.sendFile(__dirname + '/preview.html'), 1000);
});

app.get('/remove', (req, res) => {
	if (!('uuid' in req.cookies) || uuids.get(req.cookies.uuid) === undefined) {
		res.clearCookie('uuid');
		gobackhome(res);
	}
	fs.readFile(__dirname + '/users_data.json', (err, data) => {
		if (err) throw err;
		let body = JSON.parse(data),
			user = uuids.get(req.cookies.uuid);
		stickies = body[user.toLowerCase()].stickies;
		setTimeout(() => res.render('remove', { stickies: stickies }), 1000);
	});
});

app.get('/', (req, res) => {
	setTimeout(() => res.render(`index`, { bool: 'uuid' in req.cookies }), 1000);
});

app.get('/users/:user', (req, res) => {
	fs.readFile(__dirname + '/users_data.json', (err, data) => {
		if (err) {
			console.error(err);
			return;
		}
		let body = JSON.parse(data),
			user = req.params.user;
		if (!(user.toLowerCase() in body)) {
			res.render('error', {
				code: 404,
				msg: 'User Not Found',
				desc: 'The requested user could not be found by the server.',
			});
			return;
		}
		user = body[user.toLowerCase()];
		let name = user.user.name,
			size = '16';
		res.render('user', { name: name, user: user, size: size });
	});
});

app.get('/users/:user/bbcode', (req, res) => {
	fs.readFile(__dirname + '/users_data.json', (err, data) => {
		if (err) {
			console.error(err);
			return;
		}
		let body = JSON.parse(data),
			user = req.params.user;
		if (!(user.toLowerCase() in body)) {
			res.render('error', {
				code: 404,
				msg: 'User Not Found',
				desc: 'The requested user could not be found by the server.',
			});
			return;
		}
		user = body[user.toLowerCase()];
		let name = user.user.name,
			size = '16';
		res.render('bbcode', { name: name, user: user, size: size });
	});
});

app.get('/all_users', (req, res) => {
	fs.readFile(__dirname + '/users_data.json', (err, data) => {
		if (err) {
			throw err;
		}
		let body = JSON.parse(data);
		setTimeout(() => {
			res.render('all_users', { body: body });
		}, 100);
	});
});

app.get('/api/user_redirect', (req, res) => {
	res.redirect(`/users/${req.query.user}`);
});

app.get('/api/users/:user', cors(), (req, res) => {
	fs.readFile(__dirname + '/users_data.json', (err, data) => {
		if (err) throw err;
		let body = JSON.parse(data),
			user = req.params.user;
		if (!(user.toLowerCase() in body)) {
			res.status(404);
			res.send({
				error: 404,
				message: 'User Not Found',
				description: 'The requested user could not be found by the server.',
			});
			return;
		}
		let user_data = body[user.toLowerCase()];
		res.send(user_data);
	});
});

app.get('/credits', (_, res) => {
	fs.readFile(__dirname + '/static/contributers.json', (err, data) => {
		if (err) throw err;
		res.render('credits', { body: JSON.parse(data) });
	});
});

app.get('/me', (req, res) => {
	if (!('uuid' in req.cookies) || uuids.get(req.cookies.uuid) === undefined) {
		res.redirect('/');
		return;
	}
	res.redirect(`/users/${uuids.get(req.cookies.uuid)}`);
});

app.get('/me_embed', (req, res) => {
	fs.readFile(__dirname + '/users_data.json', (err, data) => {
		if (err) throw err;
		let body = JSON.parse(data);
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
		});
	});
});

app.get('/api', (_, res) => {
	res.sendFile(__dirname + '/docs.html');
});

app.get('/dev', (req, res) => {
	fs.readFile(__dirname + '/users_data.json', (err, data) => {
		if (err) throw err;
		if (!('uuid' in req.cookies) || uuids.get(req.cookies.uuid) === undefined) {
			gobackhome(res);
			return;
		}
		let user = uuids.get(req.cookies.uuid),
			body = JSON.parse(data);
		user = body[user.toLowerCase()];
		let stickies = user.stickies;
		res.render('development', { stickies: stickies });
	});
});

app.get('/stats', (_, res) => {
	res.render('status', { status: status });
})

app.listen(3000, () => {
	console.log('-- Server Stats --');
	const current_time = new Date(),
		parsed_time = `${
			current_time.getMonth() + 1
		}(m) ${current_time.getDate()} ${current_time.getFullYear()} ${current_time.getHours()}:${current_time.getMinutes()}:${current_time.getSeconds()}`;
	console.log(
		`Server started: ${parsed_time}`
	);
	status += `<div class="on_start">Server started: <time>${parsed_time}</time></div>`;
	fs.readFile(__dirname + '/users_data.json', (err, data) => {
		if (err) throw err;
		let users = Object.keys(JSON.parse(data));
		console.log(`There are ${users.length} user(s) in the DataBase`);
		status += `<div class="on_start"><span id="user_ammount">${users.length}</span> user(s)</div>`;
	});
	setInterval(() => {
		let new_time = new Date(),
			parsed_new = `${
			new_time.getMonth() + 1
		}(m) ${new_time.getDate()} ${new_time.getFullYear()} ${new_time.getHours()}:${new_time.getMinutes()}:${new_time.getSeconds()}`;
		uuids.clearAll();
		console.log(`=> Clearing UUIDs from the DataBase at ${parsed_new}`)
		status += `<div class="uuid_clear">UUIDs cleared at <time>${parsed_new}</time></div>`;
	}, clear);
});