const draggable = document.querySelectorAll('.input'),
	drag_containers = document.querySelectorAll('.area');

draggable.forEach(d => {
	d.addEventListener('dragstart', () => {
		d.classList.add('dragging')
	})
	d.addEventListener('dragend', () => {
		d.classList.remove('dragging')
	})
})

function wait() {
	return new Promise(r => setTimeout(() => r(), 2000))
}

let event_happening = false;

drag_containers.forEach(c => {
	c.addEventListener('dragover', async () => {
		await wait();
		if (event_happening)
			return;
		let dragged = document.querySelector('.dragging'),
			replacing = c.querySelector('.input')
		event_happening = true;
		rearrange(dragged.dataset.input, replacing.dataset.input);
		event_happening = false;
	});
})

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
	index_parent.innerHTML = location_child.outerHTML;
	location.innerHTML = index.outerHTML;
}

document.querySelector('#submit')
	.addEventListener('click', () => {
		let arrangment = locations.join(','),
			submit_url = `/api/rearrange?indexes=${arrangment}`;
		console.log(submit_url);
	})