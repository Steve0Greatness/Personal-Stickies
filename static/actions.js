const bbcode_button = document.querySelector('#bbc_action'),
	bbcode_dialog = document.querySelector('#bb-code'),
	bbcode_copy = document.querySelector('#copy_button'),
	bbcode = document.querySelector('#bb-code_area'),
	bbcode_show_hide = document.querySelector('#bbc_action_sh')
var bbcode_open = false;

bbcode_dialog.removeAttribute('open');

bbcode_button.addEventListener('click', () => {
	bbcode_open = !bbcode_open;
	if (bbcode_open) {
		bbcode_dialog.setAttribute('open', true);
		bbcode_show_hide.innerText = 'Hide';
		return;
	}
	bbcode_dialog.removeAttribute('open');
	bbcode_show_hide.innerText = 'Show';
});

bbcode_copy.addEventListener('click', () =>
	navigator.clipboard.writeText(bbcode.value)
);