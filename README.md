# Boutiki, front

Application web de Boutiki, un logiciel de gestion de stock pour plusieurs boutiques : ventes et tickets, produits, caisse, inventaires, alertes de stock, clients et dettes. Pensée pour le téléphone d'abord.

Angular 22 (composants autonomes et signals). L'API est dans le dépôt `gestionnaire_stock`.

## Démarrage

```bash
npm install
npm start          # http://localhost:4200
```

En développement, le front appelle `/api/...` et le proxy ([proxy.conf.json](proxy.conf.json)) envoie la requête à l'API sur `http://localhost:3000`. Il faut donc lancer l'API en même temps.

Pour ouvrir l'application depuis un téléphone sur le même réseau Wi-Fi : `npm run start:reseau`, puis ouvrir l'adresse de l'ordinateur avec le port 4200.

## Scripts

- `npm start` : serveur de développement
- `npm run build` : version de production dans `dist/`
- `npm test` : tests unitaires (Vitest)

## Structure

```
src/app/
  core/       services, modèles et gardes de routes (appels à l'API)
  shared/     composants, pipes et utilitaires réutilisés partout
  layout/     barre latérale, en-tête, recherche, notifications
  features/   une page ou un groupe de pages par module (ventes, produits, caisse...)
```
