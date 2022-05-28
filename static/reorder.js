let locations = [];
function fillup(len) {
	for (let i = 0; i < len; i++) {
		locations.push(i);
	}
}

function rearrange(ind, loc) {
	if (ind > locations.length || loc > locations.length) return;
	locations = locations.map(l => {
		if (l === loc) return ind;
		if (l === ind) return loc;
		return l;
	})
	let location = document.querySelector(`[data-index="${loc}"]`),
		index = document.querySelector(`[data-input="${ind}"]`),
		index_parent = index.parentElement,
		location_child = location.childNodes[0];
	console.log(location, location_child, index, index_parent)
	index_parent.innerHTML = location_child.outerHTML;
	location.innerHTML = index.outerHTML;
}

document.querySelector('#submit')
	.addEventListener('click', () => {
		let arrangment = locations.join(','),
			submit_url = `/api/rearrange?indexes=${arrangment}`;
		console.log(submit_url);
	})