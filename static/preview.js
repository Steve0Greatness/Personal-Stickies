const preview_location = document.querySelector('#preview');
function preview(id) {
	fetch(`https://scratchdb.lefty.one/v3/forum/topic/posts/${id}/0?o=oldest`)
		.then(e => e.json())
		.then(e => {
			let topic = e[0].topic;
			preview_location.innerHTML = `<img src="/sticky.png"> Sticky: <a href="${topic.id}">${topic.title}</a> by ${e[0].username}`;
			preview_location.parentElement.setAttribute('open', true);
		});
}

preview_location.parentElement
	.querySelector('#close_preview')
	.addEventListener('click', () => {
		preview_location.parentElement.removeAttribute('open');
	});