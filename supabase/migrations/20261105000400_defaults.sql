-- Paramètres et conversions par défaut (modifiables dans l'administration).
insert into public.site_settings (key, value) values
  ('general', '{"siteName": "Ana Finance", "siteUrl": "https://ana-finance.github.io/site/", "language": "fr"}'),
  ('contact', '{"email": "", "phone": "", "address": ""}'),
  ('social', '{"linkedin": "", "x": "", "youtube": ""}'),
  ('seo', '{"titleSuffix": " — Ana Finance", "defaultOgImage": null}'),
  ('analytics', '{"provider": "plausible", "domain": "", "scriptSrc": "https://plausible.io/js/script.js"}')
on conflict (key) do nothing;

insert into public.conversion_definitions (event_name, label, description, is_conversion) values
  ('form_demo_success', 'Demande de démo envoyée', 'Formulaire de démo enregistré avec succès (confirmé par le serveur).', true),
  ('form_resource_success', 'Ressource demandée', 'Formulaire de la page Ressources enregistré avec succès.', true),
  ('cta_demo', 'Clic « Demander une démo »', 'Clic sur un lien vers la page démo.', false),
  ('click_phone', 'Clic sur un numéro de téléphone', 'Lien tel:.', true),
  ('click_email', 'Clic sur une adresse e-mail', 'Lien mailto:.', true),
  ('click_platform', 'Clic « Accéder à la plateforme »', 'Lien sortant vers l''application.', false)
on conflict (event_name) do nothing;
