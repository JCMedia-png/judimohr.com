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
    // Answers are emailed to Judi through FormSubmit (data-endpoint). The site is static on
    // GitHub Pages, so it has no server of its own.
    const endpoint = form.dataset.endpoint;
    if (endpoint) {
      const v = (key) => (form.elements[key] ? String(form.elements[key].value || '').trim() : '');
      // Brandon's red flag test: C and D are tagged, not blocked, until a quarter of data says otherwise.
      const redFlag = /^[CD]:/.test(v('approach'));
      const payload = {
        _subject: `${redFlag ? '[Red flag] ' : ''}New application from judimohr.com: ${v('name')}`,
        _template: 'table',
        _captcha: 'false',
        _replyto: v('email'),
        _honey: v('website'),
        Name: v('name'),
        Email: v('email'),
        Phone: v('phone'),
        Situation: v('situation'),
        'Planning to retire': v('retire'),
        State: v('state'),
        'Saved and invested': v('assets'),
        'Approach (red flag test)': v('approach'),
        'Red flag': redFlag ? 'Yes: picked C or D. Brandon found these show and buy at about half the rate. Not blocked.' : 'No',
        Next: 'They were sent to the booking page. If no booking shows up in OnceHub within a day, give them a call.',
      };
      try {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 6000);
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        window.clearTimeout(timer);
      } catch (e) {
        // Never stop someone from booking because of a network hiccup or a slow form service.
      }
    }
    // Meta pixel goes here later: fire Lead only for qualified answers (Brandon: pixel conditioning).
    window.location.href = 'book.html';
  });

  show(0);
})();

/* ---------- Judi's VSL: YouTube underneath, our own look on top ----------
   YouTube's title, logo and controls are hidden: the player is taller than the frame, so its
   chrome sits in the cropped letterbox, and a cover on top takes every click. It autoplays muted
   (captions are burned in); one tap restarts it from the top with sound. */
(() => {
  'use strict';
  const fig = document.querySelector('[data-yt]');
  if (!fig) return;
  const id = fig.dataset.yt;
  const cover = fig.querySelector('[data-cover]');
  const sound = fig.querySelector('[data-sound]');
  const end = fig.querySelector('[data-ytend]');
  const again = fig.querySelector('[data-replay]');
  const label = sound.querySelector('span:last-child');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let player = null;
  let withSound = false;

  const set = (state) => { fig.dataset.state = state; };
  set('loading');
  sound.hidden = false;
  if (reduceMotion) label.textContent = 'Play the video with sound';

  const startWithSound = () => {
    if (!player) return;
    withSound = true;
    sound.hidden = true;
    end.hidden = true;
    player.unMute();
    player.setVolume(100);
    player.seekTo(0, true);
    player.playVideo();
  };

  window.onYouTubeIframeAPIReady = () => {
    player = new window.YT.Player('yt-player', {
      host: 'https://www.youtube-nocookie.com',
      videoId: id,
      playerVars: {
        autoplay: reduceMotion ? 0 : 1, mute: 1, controls: 0, disablekb: 1, fs: 0,
        iv_load_policy: 3, modestbranding: 1, playsinline: 1, rel: 0, cc_load_policy: 0,
        origin: window.location.origin,
      },
      events: {
        onReady: (e) => {
          e.target.mute();
          if (!reduceMotion) e.target.playVideo();
          else set('paused');
        },
        onStateChange: (e) => {
          const S = window.YT.PlayerState;
          if (e.data === S.PLAYING) { set('playing'); end.hidden = true; }
          else if (e.data === S.PAUSED) set('paused');
          else if (e.data === S.ENDED) {
            set('ended');
            end.hidden = false;
            sound.hidden = true;
          }
        },
      },
    });
  };

  sound.addEventListener('click', startWithSound);
  cover.addEventListener('click', () => {
    if (!player) return;
    if (!withSound) { startWithSound(); return; }
    const S = window.YT.PlayerState;
    if (player.getPlayerState() === S.PLAYING) player.pauseVideo();
    else player.playVideo();
  });
  again.addEventListener('click', startWithSound);

  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  tag.async = true;
  document.head.appendChild(tag);
})();

/* ---------- booking page: switch to "Done" once OnceHub confirms the booking ---------- */
(() => {
  'use strict';
  const booked = document.querySelector('[data-booked]');
  if (!booked) return;
  const done = () => {
    if (!booked.hidden) return;
    const label = document.querySelector('[data-progress-label]');
    const bar = document.querySelector('[data-progress] .progress__bar span');
    const title = document.querySelector('[data-book-title]');
    const note = document.querySelector('[data-book-note]');
    const help = document.querySelector('[data-book-help]');
    if (label) label.textContent = 'Done';
    if (bar) bar.style.width = '100%';
    if (title) title.textContent = 'You’re booked in.';
    if (note) note.textContent = 'Your confirmation is on its way to your email. Here’s how to get the most from your conversation with Judi.';
    if (help) help.hidden = true;
    document.title = 'You’re booked in | Money Confidence with Judi';
    booked.hidden = false;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    // Meta pixel goes here later: fire Schedule (Brandon: only for qualified answers).
  };
  window.judiBooked = done;
  if (window.__judiBookedData) done();
  // Backup: OnceHub's newer embeds post a message when a booking is scheduled.
  window.addEventListener('message', (e) => {
    let host = '';
    try { host = new URL(e.origin).hostname; } catch (err) { return; }
    if (!/oncehub\.com$/.test(host)) return;
    const d = e.data;
    const type = typeof d === 'string' ? d : (d && (d.type || d.event || d.eventName)) || '';
    if (/booking\.scheduled|booking_scheduled|bookingScheduled/i.test(String(type))) done();
  });
})();
