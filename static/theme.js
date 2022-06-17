// Notice: This is not the actual code for themeing, it's simply the way that the defualt theme of your browser is detected.
const has = name => {
	let cookies = document.cookie.split(';');
	let ret = false;
	for (let i = 0; i < cookies.length; i++) {
		let cook = cookies[i].split('=')[0];
		if (cook.trim() === name) {
			ret = true;
			break;
		}
	}
	return ret;
}
(function() {
	if (!has('theme'))
		return;
	const set = (name, val, delDate = false) => {
			let max = "";
			if (delDate) max = "expires:" + new Date(delDate[0], delDate[1], delDate[3]).toUTCString() + ";";
			document.cookie = name + "=" + encodeURIComponent(val) + ";SameSite=Lax;" + max;
		},
		current_theme = window.matchMedia('(prefers-color-scheme:light)').matches ? 'light' : 'dark';
	set('theme', current_theme)
})