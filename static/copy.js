let copy = document.querySelector('#copy'),
	button = document.querySelector('#copy_button');
button.addEventListener('click', () => {
	navigator.clipboard.writeText(copy.value)
		.catch(_ => {
			try {
				copy.focus();
				copy.select();
				document.execCommand('copy')
				copy.selectionEnd = copy.selectionStart;
				copy.blur()
			} catch (_) {
				alert('Unable to copy text automatically, try doing it manually.')
			}
		});
	button.innerText = 'Copied!';
	setTimeout(() => {
		button.innerText = 'Copy BBCode';
	}, 2500)
});