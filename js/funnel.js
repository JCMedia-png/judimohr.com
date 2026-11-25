/* Funnel behaviour: the muted VSL and the one-question-at-a-time application.
   No dependencies. With scripts off, the video has its own controls and the form shows every
   question and posts to apply.php, which sends the visitor on to the booking page. */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- VSL: autoplays muted with burned-in captions; one tap restarts it with sound ---------- */
  $$('[data-vsl]').forEach((fig) => {
    const video = $('video', fig);
    const sound = $('[data-sound]', fig);
    if (!video || !sound) return;

    const label = $('span:last-child', sound);
    video.controls = false;
    sound.hidden = false;

    if (reduceMotion) {
      video.removeAttribute('autoplay');
      video.pause();
      label.textContent = 'Play the video with sound';
    } else {
      const attempt = video.play();
      if (attempt && attempt.catch) attempt.catch(() => { label.textContent = 'Play the video with sound'; });
    }

    sound.addEventListener('click', () => {
      video.muted = false;
      video.currentTime = 0;
      video.controls = true;
      sound.hidden = true;
      const attempt = video.play();
      if (attempt && attempt.catch) attempt.catch(() => {});
    });
  });

  /* ---------- the application ---------- */
  const form = $('[data-survey]');
  if (!form) return;

  const steps = $$('[data-step]', form);
  const bar = $('[data-bar]', form);
  const count = $('[data-count]', form);
  const back = $('[data-back]', form);
  const error = $('[data-error]', form);
  let index = 0;

  const show = (next, goingBack = false) => {
    index = Math.max(0, Math.min(steps.length - 1, next));
    steps.forEach((step, i) => {
      step.classList.toggle('is-on', i === index);
      step.classList.toggle('is-back', i === index && goingBack);
    });
    // The bar never reads full before the booking page: that is where the process ends.
    bar.style.width = `${Math.round(((index + 1) / (steps.length + 1)) * 100)}%`;
    count.textContent = `Question ${index + 1} of ${steps.length}`;
    back.hidden = index === 0;
  };

  const isContact = (step) => step.classList.contains('qstep--contact');

  steps.forEach((step, i) => {
    if (isContact(step)) return;
    step.addEventListener('change', (event) => {
      const input = event.target;
      if (input.type !== 'radio') return;
      // The state question: Judi can only discuss securities business in seven states.
      if (input.name === 'state' && input.value === 'Other') {
        window.setTimeout(() => { window.location.href = 'not-a-fit.html'; }, 220);
        return;
      }
      window.setTimeout(() => {
        show(i + 1);
        const first = $('input', steps[i + 1]);
        if (first && !isContact(steps[i + 1])) first.focus({ preventScroll: true });
        else if (first) first.focus({ preventScroll: true });
      }, reduceMotion ? 0 : 220);
    });
  });

  back.addEventListener('click', () => show(index - 1, true));

  const fail = (message, field) => {
    error.textContent = message;
    error.hidden = false;
    if (field) {
      field.setAttribute('aria-invalid', 'true');
      field.focus();
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.hidden = true;
    $$('[aria-invalid]', form).forEach((el) => el.removeAttribute('aria-invalid'));

    // A question skipped with Back and forward again: send them to it.
    for (let i = 0; i < steps.length; i += 1) {
      if (isContact(steps[i])) continue;
      if (!$('input:checked', steps[i])) { show(i, true); return; }
    }
    const name = form.elements.name;
    const email = form.elements.email;
    const phone = form.elements.phone;
    if (name.value.trim().length < 2) return fail('Please add your full name.', name);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) return fail('Please check your email address.', email);
    if (phone.value.replace(/\D/g, '').length < 10) return fail('Please add a phone number with area code.', phone);

    form.classList.add('is-sending');
    // No form backend yet (the site is static on GitHub Pages). Set data-endpoint to a form
    // service URL, or to apply.php on PHP hosting, to start receiving the answers.
    const endpoint = form.dataset.endpoint;
    if (endpoint) {
      try {
        await fetch(endpoint, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      } catch (e) {
        // Never stop someone from booking because of a network hiccup.
      }
    }
    // Meta pixel goes here later: fire Lead only for qualified answers (Brandon: pixel conditioning).
    window.location.href = 'book.html';
  });

  show(0);
})();
