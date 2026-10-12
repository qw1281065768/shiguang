/* A short, non-interactive title sequence before chapter select.
   The live 3D diner remains behind the composited rain and type, so the
   visual language carries directly into the first playable memory. */
(function () {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const prologue = $('#prologue'), menu = $('#intro');
  if (!prologue || !menu) return;
  const cards = [...prologue.querySelectorAll('[data-prologue-card]')];
  const marks = [...prologue.querySelectorAll('.prologue-progress i')];
  const enter = $('#enterChapters');
  let frame = 0, timer = 0, complete = false;
  function show(index) {
    frame = index;
    cards.forEach((card, i) => card.classList.toggle('active', i === index));
    marks.forEach((mark, i) => mark.classList.toggle('active', i <= index));
    if (index === cards.length - 1) enter.hidden = false;
  }
  function finish() {
    if (complete) return;
    complete = true;
    clearTimeout(timer);
    prologue.classList.add('leaving');
    setTimeout(() => { prologue.hidden = true; menu.hidden = false; $('#play')?.focus(); }, 560);
  }
  function advance() {
    if (complete) return;
    if (frame < cards.length - 1) { show(frame + 1); timer = setTimeout(advance, 4700); }
    else timer = setTimeout(finish, 4200);
  }
  $('#skipPrologue')?.addEventListener('click', finish);
  enter?.addEventListener('click', finish);
  timer = setTimeout(advance, 4700);
})();
