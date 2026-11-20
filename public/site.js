const $ = (id) => document.getElementById(id);
const safeUrl = (value) => { try { const u = new URL(value); return ['https:','http:','mailto:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
function text(node, value) { if (node) node.textContent = value ?? ''; }
function renderProjects(projects) {
  const grid = $('project-grid'); if (!grid) return;
  grid.replaceChildren();
  projects.forEach((p, i) => {
    const card = document.createElement('article'); card.className = 'project-card';
    const art = document.createElement('div'); art.className = 'project-art';
    if (p.image_url && safeUrl(p.image_url)) {
      const img = document.createElement('img'); img.src = safeUrl(p.image_url); img.alt = p.title || 'Project image'; img.loading = 'lazy'; art.append(img);
    } else {
      art.classList.add(['art-one','art-two','art-three'][i % 3]);
      const number = document.createElement('span'); number.textContent = String(i + 1).padStart(2,'0');
      const motif = document.createElement('i'); motif.textContent = p.title || 'Selected work'; art.append(number,motif);
    }
    const meta = document.createElement('div'); meta.className = 'project-meta';
    const info = document.createElement('div'); const title = document.createElement('h3'); title.textContent = p.title;
    const category = document.createElement('p'); category.textContent = p.category || 'Selected work'; info.append(title,category);
    const arrow = document.createElement('span'); arrow.textContent = '↗'; meta.append(info,arrow); card.append(art,meta);
    const url = safeUrl(p.project_url); if (url) { const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.className = 'project-link'; a.setAttribute('aria-label', `View ${p.title}`); a.append(card); grid.append(a); } else grid.append(card);
  });
}
async function loadSite() {
  try {
    const res = await fetch('/api/content', {headers:{'Accept':'application/json'}});
    if (!res.ok) return;
    const data = await res.json(), s = data.settings || {};
    text($('eyebrow'),s.eyebrow); text($('hero-title'),s.hero_title); text($('hero-intro'),s.hero_intro);
    text($('about-title'),s.about_title); text($('about-text'),s.about_text); text($('location'),s.location);
    text($('contact-title'),s.contact_title); text($('contact-text'),s.contact_text);
    const email = $('email-link'); if (email && s.email) { email.href = 'mailto:' + s.email; email.textContent = s.email + ' ↗'; }
    const socials = $('social-links'); socials.replaceChildren();
    (data.socials || []).forEach(item => { const url = safeUrl(item.url); if (!url) return; const a = document.createElement('a'); a.href=url; a.target='_blank'; a.rel='noopener noreferrer'; a.textContent=item.label; socials.append(a); });
    renderProjects(data.projects || []);
  } catch (e) { console.warn('Portfolio content could not be loaded.', e); }
}
text($('year'), new Date().getFullYear()); loadSite();
