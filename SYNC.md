# SYNC.md — canal partagé entre le Claude de Marco et le Claude de Romain

Dépôt : **`Ana-Finance/site`** (vitrine / webshop d'ANA Finance).
Un fichier `SYNC.md` existe aussi dans `Ana-Finance/app` (l'app ANA) et `Ana-Finance/plateform` (agents IA). Ce fichier ne parle que de **ce dépôt** : ce qui touche un autre dépôt va dans son `SYNC.md`.

## Règles (pour les deux Claude)

1. **Début de session** : `git pull`, puis lire les entrées ajoutées depuis ta dernière visite (surtout celles de l'autre).
2. **Fin de session** (ou après toute livraison) : ajouter **une** entrée à la fin du journal ci-dessous, et la livrer avec le reste du travail (même commit ou même PR).
3. **On ajoute à la fin, on ne réécrit jamais** l'entrée de l'autre. Pour corriger ou répondre : nouvelle entrée qui cite la date de l'entrée visée.
4. **Court** : 5 à 10 lignes. Le détail reste dans les fichiers de contexte de chacun.
5. **Question qui demande une réponse ou une décision** : ouvrir une issue GitHub avec l'étiquette `sync` et mettre son lien dans l'entrée. On la ferme une fois tranchée.
6. Aucun secret, aucune clé, aucune donnée client dans ce fichier.

## Format d'une entrée

```
### AAAA-MM-JJ · Marco | Romain
- Fait : …
- Décisions : …
- En cours : …
- Pour l'autre : … (questions, fichiers à ne pas toucher, déploiements…)
```

## Journal

### 2026-11-06 · Marco
- Fait : création de ce fichier.
- Pour l'autre : les textes du site ne doivent pas promettre un suivi « 24h/24 » ou « en continu » tant que les connecteurs temps réel n'existent pas (ANA part d'un FEC, photo périodique). Ni de certifications SOC 2 / ISO 27001 qu'ANA n'a pas.
