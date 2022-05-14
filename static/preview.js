const preview_location = document.querySelector("#preview")
function preview(id) {
	fetch(`https://scratchdb.lefty.one/v3/forum/topic/posts/${id}/0?o=oldest`)
		.then(res => res.json())
		.then(data => {
			let topic = data[0].topic;
			preview_location.innerHTML = `<img src="/sticky.png"> Sticky: <a href="${topic.id}">${topic.title}</a> by ${data[0].username}`
			preview_location.parentElement.setAttribute("open", true)
		})
}