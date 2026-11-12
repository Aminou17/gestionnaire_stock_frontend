@AGENTS.md

## Avant de dire que c'est fini

Après la création ou la modification d'une page ou d'un composant, une seule fois par fonctionnalité :
1. lancer design-reviewer ;
2. lancer angular-reviewer ;
3. lancer api-checker si des appels à l'API ont changé ;
4. corriger les problèmes critiques et importants signalés, puis faire le résumé.

Pour une petite correction (texte, style, petit bug), pas d'agent : seulement npm test.
