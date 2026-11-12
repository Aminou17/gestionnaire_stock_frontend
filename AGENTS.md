# Gestionnaire de stock, front

Front Angular de la boutique Awa Bazin (vente de bazin, Congo, +242).
Le backend est dans ../gestionnaire_stock (Express et PostgreSQL, port 3000).

## Commandes

- npm start : ng serve sur http://localhost:4200 (le backend doit tourner à côté)
- npm test : Vitest
- npm run build
- npx prettier --write src : à lancer avant de commiter

En dev, proxy.conf.json redirige /api vers http://localhost:3000. On appelle l'API avec API_URL (core/api.config.ts), jamais avec une URL en dur.

## Architecture

On suit l'organisation recommandée par Angular :

- core : services uniques dans l'app (auth, guards, intercepteur, thème) et services et modèles partagés par plusieurs pages (sales, stock, cash)
- layout : structure de l'app connectée (main-layout, sidebar, bottom-nav, page-header)
- features : un dossier par fonctionnalité, avec ses pages et ses composants
- shared : ce qui sert à au moins deux features (icon, pipes)
- src/testing : helpers de test

Règles :

- un élément utilisé par une seule feature reste dans cette feature
- pas de fichier index.ts qui réexporte, on importe directement le fichier
- on crée les fichiers avec le CLI (ng g component, ng g service, ng g guard, etc.)
- noms de fichiers en kebab-case, un composant, service ou guard par fichier
- un composant a ses fichiers .ts, .html, .css et .spec.ts
- routes dans app.routes.ts, pages chargées en lazy avec loadComponent
- une nouvelle page remplace son entrée dans la liste upcoming de app.routes.ts

## Conventions Angular

Celles du guide de style officiel d'Angular :

- composants standalone, injection avec inject()
- état local avec signal et computed, application zoneless
- templates avec @if, @for et @switch
- input() et output() pour les composants enfants
- formulaires réactifs avec NonNullableFormBuilder
- appels HTTP seulement dans les services
- données d'une page chargées avec rxResource ; chaque bloc gère son chargement et son erreur avec un bouton Réessayer
- lire une ressource avec hasValue() avant value(), car value() lève une exception quand la ressource est en erreur
- en cas d'erreur, ne jamais afficher une fausse valeur par défaut (0 F, caisse fermée), mais un tiret et un message

## Façon d'écrire le code

Du code comme l'écrirait un développeur Angular ordinaire, sans rien inventer :

- noms en anglais, clairs et courts (loadSales, openCash, getRoleLabel)
- formatage géré par Prettier (4 espaces, guillemets doubles, largeur 100)
- vérifier tôt et sortir tout de suite (if (this.form.invalid) return;)
- pas de readonly, public ou type de retour ajoutés partout alors que TypeScript les déduit
- pas de try/catch défensif, pas d'abstraction prévue au cas où, pas de helper pour une seule ligne
- un gestionnaire d'événement dans un template ne doit pas renvoyer false, sinon Angular bloque le clic : passer par une méthode
- suivre le style déjà présent dans le fichier

## Commentaires

Peu de commentaires, en français, écrits simplement, comme une note pour un collègue.
On commente le pourquoi quand il n'est pas évident, jamais ce que le nom de la fonction dit déjà.
Pas de commentaire systématique au-dessus de chaque méthode, pas de JSDoc.
Pas de symboles décoratifs : ni flèches, ni points de suspension, ni guillemets français, ni puces, ni emojis.

Bon exemple : // le token expire après 1 h côté backend
Mauvais exemple : // Ouvrir le menu « ⋯ » du fournisseur…

## API

- le token JWT est ajouté par auth.interceptor.ts ; une 401 déconnecte l'utilisateur
- deux rôles : admin et manager ; l'interface cache ce que le rôle ne permet pas (auth.isAdmin()), le backend le refuse de toute façon
- les messages d'erreur du backend sont en français : on les affiche tels quels (err.error.message)
- doc des routes : ../gestionnaire_stock/docs et /api-docs

## Tests

- chaque service, guard, intercepteur et page a son .spec.ts à côté
- Vitest (describe, it, vi.fn()), noms de tests en anglais (should ...)
- HTTP testé avec provideHttpClientTesting et HttpTestingController, httpMock.verify() dans afterEach
- dans un test de composant on mocke les services et on vérifie ce que l'utilisateur voit

## Interface

Général :

- tout le texte affiché est en français, avec un ton naturel propre à la boutique
- pour les écrans classiques (connexion, formulaires, listes), on reprend la disposition que tout le monde connaît
- montants en francs CFA : 245 500 F
- rôles affichés avec getRoleLabel() : admin = Propriétaire, manager = Gérant
- responsive obligatoire : mobile sous 768 px, tablette sous 1024 px ; vérifier à 375, 768, 1366 et 1920 px
- sur téléphone, un tableau devient une liste de cartes et la création passe par un bouton + flottant au-dessus de la barre du bas
- toujours width et height sur les img
- logo : public/logo.png, favicon : public/favicon.png

Couleurs et thème :

- toutes les couleurs sont des variables de src/styles.css (:root pour le clair, [data-theme="dark"] pour le sombre), aucune couleur en dur
- le thème clair est celui par défaut ; le menu latéral reste bleu nuit dans les deux thèmes
- une seule couleur d'accent, le bleu #2563EB (--primary)
- orange pour les alertes, vert pour les montants de vente, rouge pour Remboursée, Rupture, les remboursements et les boutons Supprimer, violet seulement pour le badge du prix minimum ; aucune autre couleur

Vocabulaire :

- En stock, Stock faible (jamais Stock bas), Rupture
- l'utilisateur ne voit jamais « désactivé » : un élément retiré est Supprimé, même si le backend garde la ligne avec is_active = false
- on ne dit jamais « annulée » pour une vente : l'action s'appelle Rembourser la vente

Listes :

- actions d'une ligne dans un menu ⋯ (Modifier, Supprimer), pas une rangée d'icônes
- toute la ligne ou la carte mène à la fiche de l'élément
- 20 éléments par page, la suite se charge au défilement
- les compteurs des filtres viennent du résumé du backend (includeSummary), jamais de la page chargée

Produits :

- carte sur téléphone, dans cet ordre : nom et menu, catégorie en petit gris, prix et badge, Stock X / seuil Y et badge d'état
- seuil affiché : effective_min_stock ; champ vide dans le formulaire = minStock null = seuil général de /stock-settings
- prix fixe : aucun badge ; produit négociable : badge violet Min. 1 300 F (prix de vente moins la remise maximale)
- le formulaire demande la remise maximale et affiche « Le gérant pourra vendre entre X et Y »
- on crée une catégorie ou un fournisseur depuis la liste de choix (dernière option + Créer…), qui ouvre un petit formulaire dessous
- en bas de la fiche : Vendre (tous les rôles, désactivé en rupture, mène à /sales/new?productId=) et, pour l'admin, un menu avec Modifier et Supprimer

Catégories et fournisseurs :

- la liste mène à la fiche (/categories/:id, /suppliers/:id)
- une date de création NULL s'affiche Date inconnue, jamais une date inventée

Ventes :

- même fonctionnement que la liste des produits
- pas de badge pour une vente normale, seulement le badge rouge Remboursée
- rembourser : propriétaire seulement, motif obligatoire ; le gérant ne voit pas la colonne Vendeur
- nouvelle vente : un produit une seule fois dans le panier ; prix modifiable seulement pour un produit négociable, entre le minimum et le prix de vente, et envoyé au backend seulement dans ce cas
- caisse fermée = bouton Valider la vente désactivé ; après validation on arrive sur le détail de la vente

Tableau de bord :

- admin : 4 cartes, graphique et alertes de stock, dernières ventes et activité, pas de bloc raccourcis
- gérant, dans cet ordre : bandeau de caisse (ouverte avec solde, ou fermée avec « demandez à l'administrateur de l'ouvrir »), alerte orange si une caisse précédente n'est pas clôturée, Nouvelle vente, Mes ventes du jour, Mes ventes sur 7 jours, Mes dernières ventes, Mon activité récente, Clôturer la caisse si elle est ouverte
- Produits en alerte = ruptures + stock faible, avec la répartition dessous ; les chiffres doivent se recouper entre les pages

Le gérant ne voit pas : prix d'achat, boutons de création, menus d'actions, filtre des éléments supprimés, fournisseurs.
