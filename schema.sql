PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS login_attempts (
  ip_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_started INTEGER NOT NULL,
  blocked_until INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  project_url TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO site_settings(key,value) VALUES
('name','Daniel Burden'),
('eyebrow','Independent creative / digital portfolio'),
('hero_title','Thoughtful work. Made with purpose.'),
('hero_intro','A collection of selected projects, ideas and things I care about.'),
('about_title','A little about me'),
('about_text','I’m Daniel — a curious, detail-oriented person interested in creating useful, considered digital experiences. This is a space to share my work, interests and what I’m learning.'),
('contact_title','Have something in mind?'),
('contact_text','For enquiries, collaborations or just to say hello, get in touch.'),
('email','hello@example.com'),
('location','United Kingdom'),
('socials','[]');

INSERT OR IGNORE INTO projects(id,title,category,description,image_url,project_url,sort_order) VALUES
('project-01','Selected work No. 01','Digital / Concept','A placeholder project description. Replace this with a short explanation of the brief, approach and outcome.','','',1),
('project-02','Selected work No. 02','Identity / Exploration','A second placeholder project. Add your own imagery, details and links from the dashboard.','','',2),
('project-03','Selected work No. 03','Research / Personal','A third placeholder project to show how your portfolio grid will look with real content.','','',3);
