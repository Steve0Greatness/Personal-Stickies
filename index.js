const express = require('express'),
	app = express(),
	cp = require('cookie-parser'),
	uuids = require('store'),
	fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args)),
	fs = require('fs'),
	cors = require('cors');
require('ejs');

app.use(cp());
app.use(express.static('static'));
app.set('view engine', 'ejs');
app.use(async (req, res, next) => {
	let uuid_exists = await uuids.get(req.cookies.uuid);
	if (uuid_exists === undefined) {
		res.clearCookie('uuid');
	}
	setTimeout(next, 150);
});

function gobackhome(res, time = 150) {
	setTimeout(() => res.redirect('/'), time);
}

let crypto;
try {
	(async function () {
		crypto = await import('crypto');
	})();
} catch (err) {
	console.error('crypto support is disabled!');
}

app.get('/api/auth', (req, res) => {
	fetch(`https://auth.itinerary.eu.org/api/auth/verifyToken?privateCode=${req.query.privateCode}`)
		.then((s) => s.json())
		.then((d) => {
			if (!d.valid) {
				res.redirect('/');
				return;
			}
			let uuid = crypto.randomUUID();
			uuids.set(uuid, d.username);
			res.cookie('uuid', uuid, { maxAge: 24 * 60 * 60 * 1000, httpOnly: true });
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

app.get('/api/parseURL_', (req, res) => {
	let url = new URL(req.query.url);
	url = url.pathname.split('/');
	res.redirect(`/api/remove?topicId=${url[3]}`);
});

app.get('/api/add', (req, res) => {
	fs.readFile(__dirname + '/users.json', (err, data) => {
		if (err) {
			console.error(err);
			return;
		}
		let body = JSON.parse(data);
		if (uuids.get(req.cookies.uuid) === undefined || !('uuid' in req.cookies)) {
			gobackhome(res);
			return;
		}
		let user = uuids.get(req.cookies.uuid);
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
					fetch(`https://scratchdb.lefty.one/v3/forum/topic/posts/${req.query.topicId}/0?o=oldest`)
						.then((s) => s.json())
						.then((b) => {
							body[user.toLowerCase()].stickies.push({
								topic_ID: b[0].topic.id,
								topic_NAME: b[0].topic.title,
								topic_OWNER: b[0].username,
							});
							fs.writeFile(
								__dirname + '/users.json',
								JSON.stringify(body),
								(e) => {
									console.error(e);
								}
							);
							gobackhome(res, 150);
						});
				});
		} else {
			fetch(`https://scratchdb.lefty.one/v3/forum/topic/posts/${req.query.topicId}/0?o=oldest`)
				.then((s) => s.json())
				.then((b) => {
					body[user.toLowerCase()].stickies.push({
						topic_ID: b[0].topic.id,
						topic_NAME: b[0].topic.title,
						topic_OWNER: b[0].username,
					});
					let write = new Uint8Array(Buffer.from(JSON.stringify(body)));
					fs.writeFile(__dirname + '/users.json', write, (e) => {
						console.error(e);
					});
					gobackhome(res, 150);
				});
		}
	});
});

app.get('/api/remove', (req, res) => {
	fs.readFile(__dirname + '/users.json', (err, data) => {
		if (err) {
			console.error(err);
			return;
		}
		if (uuids.get(req.cookies.uuid) === undefined || !('uuid' in req.cookies)) {
			gobackhome(res);
			return;
		}
		let body = JSON.parse(data),
			user = uuids.get(req.cookies.uuid);
		body[user.toLowerCase()].stickies = body[
			user.toLowerCase()
		].stickies.filter((e) => e.topic_ID !== parseInt(req.query.topicId));
		fs.writeFile(__dirname + '/users.json', JSON.stringify(body), (err) => {
			if (err) {
				console.error(err);
			}
		});
		gobackhome(res);
	});
});

app.get('/signin', (req, res) => {
	let red = Buffer.from('https://Personal-Stickies.stevesgreatness.repl.co/api/auth', 'utf-8').toString('base64');
	res.redirect(`https://auth.itinerary.eu.org/auth/?redirect=${red}&name=Personal%20Stickies`);
});

app.get('/add', (req, res) => {
	if (!('uuid' in req.cookies) || uuids.get(req.cookies.uuid) === undefined) {
		res.clearCookie('uuid');
		gobackhome(res);
	}
	setTimeout(() => res.sendFile(__dirname + '/preview.html'), 1000);
});

app.get('/remove', (req, res) => {
	if (!('uuid' in req.cookies) || uuids.get(req.cookies.uuid) === undefined) {
		res.clearCookie('uuid');
		gobackhome(res);
	}
	setTimeout(() => res.sendFile(__dirname + '/remove.html'), 1000);
});

app.get('/', (req, res) => {
	setTimeout(() => res.render(`index`, { bool: 'uuid' in req.cookies }), 1000);
});

app.get('/users/:user', (req, res) => {
	fs.readFile(__dirname + '/users.json', (err, data) => {
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

app.get('/all_users', (req, res) => {
	fs.readFile(__dirname + '/users.json', (err, data) => {
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
	fs.readFile(__dirname + '/users.json', (err, data) => {
		if (err) throw err;
		let body = JSON.parse(data),
			user = req.params.user,
			user_data = body[user.toLowerCase()];
		res.send(user_data);
	});
});

app.get('/credits', (req, res) => {
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
	fs.readFile(__dirname + '/users.json', (err, data) => {
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

app.listen(3000, () => {
	fs.readFile(__dirname + '/users.json', (err, data) => {
		if (err) throw err;
		console.log(`There are ${Object.keys(JSON.parse(data)).length} user(s) in the DataBase`
		);
	});
});