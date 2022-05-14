const express = require('express'),
	app = express(),
	cp = require('cookie-parser'),
	uuids = require('store'),
	fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)),
	fs = require('fs'),
	cors = require('cors');

app.use(cp());
app.use(express.static('static'));
app.use(async (req, res, next) => {
	let uuid_exists = await uuids.get(req.cookies.uuid);
	if (uuid_exists === undefined) {
		res.clearCookie('uuid');
	}
	setTimeout(next, 150);
})

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
		.then(s => s.json())
		.then(d => {
			if (!d.valid) {
				res.redirect('/');
				return;
			}
			let uuid = crypto.randomUUID();
			uuids.set(uuid, d.username)
			res.cookie('uuid', uuid, { maxAge: 24*60*60*1000, httpOnly: true });
			gobackhome(res)
		})
});

app.get('/logout', (req, res) => {
	uuids.remove(req.cookies.uuid);
	res.clearCookie('uuid');
	gobackhome(res)
});

app.get('/api/parseURL', (req, res) => {
	let url = new URL(req.query.url);
	url = url.pathname.split("/")
	res.redirect(`/api/add?topicId=${url[3]}`)
})

app.get('/api/parseURL_', (req, res) => {
	let url = new URL(req.query.url);
	url = url.pathname.split("/")
	res.redirect(`/api/remove?topicId=${url[3]}`)
})

app.get('/api/add', (req, res) => {
	fs.readFile(__dirname + '/users.json', (err, data) => {
		if (err) {
			console.error(err);
			return;
		}
		let body = JSON.parse(data);
		if (!uuids.get(req.cookies.uuid) || !("uuid" in req.cookies)) {
			gobackhome(res)
			return;
		}
		let user = uuids.get(req.cookies.uuid);
		if (!(user in body)) {
			fetch(`https://scratchdb.lefty.one/v3/user/info/${user}`)
				.then(s => s.json())
				.then(d => {
					body[user.toLowerCase()] = {
						user: {
							id: d.id,
							name: user
						},
						stickies: []
					};
					fetch(`https://scratchdb.lefty.one/v3/forum/topic/posts/${req.query.topicId}/0?o=oldest`)
						.then(s => s.json())
						.then(b => {
							body[user.toLowerCase()].stickies.push({
								topic_ID: b[0].topic.id,
								topic_NAME: b[0].topic.title,
								topic_OWNER: b[0].username
							})
							fs.writeFile(__dirname + "/users.json", JSON.stringify(body), (e) => {
								console.error(e)
							});
							gobackhome(res, 150)
						})
				})
		} else {
			fetch(`https://scratchdb.lefty.one/v3/forum/topic/posts/${req.query.topicId}/0?o=oldest`)
				.then(s => s.json())
				.then(b => {
					body[user.toLowerCase()].stickies.push({
						topic_ID: b[0].topic.id,
						topic_NAME: b[0].topic.title,
						topic_OWNER: b[0].username
					})
					let write = new Uint8Array(Buffer.from(JSON.stringify(body)));
					fs.writeFile(__dirname + "/users.json", write, (e) => {
						console.error(e)
					});
					gobackhome(res, 150)
				})
		}
	})
})

app.get('/api/remove', (req, res) => {
	fs.readFile(__dirname + '/users.json', (err, data) => {
		if (err) {
			console.error(err);
			return;
		}
		if (!uuids.get(req.cookies.uuid) || !("uuid" in req.cookies)) {
			gobackhome(res)
			return;
		}
		let body = JSON.parse(data),
			user = uuids.get(req.cookies.uuid);
		body[user.toLowerCase()].stickies = body[user.toLowerCase()].stickies.filter(e => e.topic_ID !== parseInt(req.query.topicId))
		fs.writeFile(__dirname + "/users.json", JSON.stringify(body), (err) => {
			if (err) {
				console.error(err)
			}
		})
		gobackhome(res)
	})
})

app.get('/signin', (req, res) => {
	let red = Buffer.from('https://Personal-Stickies.stevesgreatness.repl.co/api/auth', 'utf-8').toString('base64');
	res.redirect(`https://auth.itinerary.eu.org/auth/?redirect=${red}&name=Personal%20Stickies`);
});

app.get('/add', (req, res) => {
	if (!('uuid' in req.cookies) || uuids.get(req.cookies.uuid) === undefined) {
		res.clearCookie('uuid');
		gobackhome(res);
	}
	res.sendFile(__dirname + '/preview.html')
});

app.get('/remove', (req, res) => {
	if (!('uuid' in req.cookies) || uuids.get(req.cookies.uuid) === undefined) {
		res.clearCookie('uuid');
		gobackhome(res);
	}
	res.sendFile(__dirname + '/remove.html')
});

app.get('/', (req, res) => {
	res.send(`<!doctype html>
<html lang="en">

<head>
	<meta charset="UTF-8">
	<meta http-equiv="X-UA-Compatible" content="IE=edge">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Home</title>
	<link rel="stylesheet" href="/style.css">
</head>

<body>
	<h1>Personal Stickies</h1>
	${!('uuid' in req.cookies) ? '<a class="account" href="/signin">Login</a>' : '<nav><a class="nav" href="/add">Add Stickies</a> <a class="nav" href="/remove">Remove Sticky</a></nav><a class="account" href="/logout">Logout</a>'}
	<form action="/api/user_redirect"><label for="user">Find a user:</label> <input required type="text" id="user" name="user"><p><input type="submit" value="Go to profile"> <a href="/all_users" class="button">See All Users</a></p></form>
</body>

</html>`)
})

app.get('/users/:user', (req, res) => {
	fs.readFile(__dirname + "/users.json", (err, data) => {
		if (err) {
			console.error(err)
			return;
		}
		let body = JSON.parse(data),
			user = req.params.user
		if (!(user.toLowerCase() in body)) {
			res.send("<h1>USER NOT FOUND</h1>")
			return;
		}
		user = body[user.toLowerCase()]
		let { id, name } = user.user,
			size = "16",
			html = `<div id="user_info"><a href="//scratch.mit.edu/users/${name}"><img src="//cdn2.scratch.mit.edu/get_image/user/${id}_${size}x${size}.png">${name}</a></div><div id="user_pins">`
		for (let s of user.stickies) {
			let { topic_ID, topic_NAME, topic_OWNER } = s;
			html += `<div class="sticky">
    <img src="/sticky.png"> Sticky:
    <a href="//scratch.mit.edu/discuss/topic/${topic_ID}">${topic_NAME}</a>
    by ${topic_OWNER}
    <a href="//scratch.mit.edu/discuss/topic/${topic_ID}/unread/">(New Posts)</a>
</div>`;
		}
		if (user.stickies.length === 0) {
			html += `<h1>This User Doesn't Have Any Stickies</h1>`
		}
		html += '</div>'
		res.send(`<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${name}'(s) Personal Stickies</title><link rel="stylesheet" href="/style.css"></head><body>${html}</body></html>`)
	})
})

app.get('/all_users', (req, res) => {
	fs.readFile(__dirname + '/users.json', (err, data) => {
		if (err) {
			throw err;
		}
		let body = JSON.parse(data),
			html = `<ul>`;
		for (let user in body) {
			html += `<li><a href="/users/${body[user].user.name}">${body[user].user.name}</a></li>`
		}
		html += `</ul>`
		setTimeout(() => { res.send(`<!doctype html><html lang="en-US">
<head><meta charset="UTF-8"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>All Users</title><link rel="stylesheet" href="/style.css"></head>
<body><h1>All Users</h1>
<p>These are all the users on this platform</p>
${html}</body>
</html>`) }, 100)
	})
})

app.get('/api/user_redirect', (req, res) => {
	res.redirect(`/users/${req.query.user}`)
})

app.get('/api/user/:user', cors(), (req, res) => {
	fs.readFile(__dirname + '/users.json', (err, data) => {
		if (err)
			throw err;
		let body = JSON.parse(data),
			user = req.params.user,
			user_data = body[user.toLowerCase()];
		res.send(user_data);
	})
})

app.get('/credits', (req, res) => {
	res.sendFile(__dirname + '/credits.html');
})

app.listen(3000, () => {});