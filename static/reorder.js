const draggable = document.querySelectorAll('.input'),
	drag_containers = document.querySelectorAll('.area');

function add_listeners(d) {
	d.addEventListener('dragstart', e => {
		e.target.classList.toggle('dragging');
	});
	d.addEventListener('dragend', e => {
		e.target.classList.toggle('dragging');
	});
}

draggable.forEach(add_listeners);

function wait(a) {
	return new Promise(r => setTimeout(() => r(), a));
}

let event_happening = false;
drag_containers.forEach(c => {
	c.addEventListener('dragover', async () => {
		if (event_happening)
			return;
		event_happening = true;
		let dragged = document.querySelector('.input.dragging'),
			replacing = c.querySelector('.input')
		if (dragged.dataset.input === replacing.dataset.input) {
			event_happening = false;
			return;
		}
		await rearrange(dragged.dataset.input, replacing.parentElement.dataset.index);
		await wait(1000);
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
		if (l == loc) return ind;
		if (l == ind) return loc;
		return l;
	})
	let location = document.querySelector(`[data-index="${loc}"]`),
		index = document.querySelector(`[data-input="${ind}"]`),
		index_parent = index.parentElement,
		location_child = location.childNodes[0];
	index_parent.innerHTML = location_child.outerHTML;
	location.innerHTML = index.outerHTML;
	let new_index = index_parent.querySelector(`.input`),
		new_loc_child = document.querySelector(`[data-input="${ind}"]`);
	add_listeners(new_index);
	add_listeners(new_loc_child);
	new_index.classList.remove('dragging');
	new_loc_child.classList.remove('dragging');
	return;
}

document.querySelector('#submit')
	.addEventListener('click', () => {
		let arrangment = locations.join(','),
			submit_url = `/api/rearrange?indexes=${arrangment}`;
		location.replace(submit_url);
	})