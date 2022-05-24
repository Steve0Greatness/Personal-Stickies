let locations = [];
function fillup(len) {
	for (let i = 0; i < len; i++) {
		locations.push(i);
	}
}

function rearrange(ind, loc) {
	locations = locations.map(l => {
		if (l === loc) return ind;
		if (l === ind) return loc;
		return l;
	})
	let location = document.querySelector(`[data-index="${loc}"]`),
		index = document.querySelector(`[data-input="${ind}"]`).cloneNode(true),
		index_parent = document.querySelector("[data-input=\"0\"]").parentElement,
		location_child = document.querySelector(`[data-index="${loc}"] > .input`);
	index_parent.replaceChild(location_child, index_parent.firstChild);
	location.appendChild(index);
}

document.querySelector('#submit')
	.addEventListener('click', () => {
		let arrangment = locations.join(','),
			submit_url = `/api/rearrange?indexes=${arrangment}`;
		console.log(submit_url);
	})