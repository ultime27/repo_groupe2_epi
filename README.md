# SAÉ ERO1 - Optimisation des Opérations de Déblaiement Hivernal à Montréal

Ce projet implémente une plateforme web d'aide à la décision et un moteur algorithmique de Recherche Opérationnelle dédiés à la planification de la flotte de déneigement de la Ville de Montréal. Le problème est modélisé sous la forme d'un Problème du Postier Chinois Orienté (DCPP) avec partitionnement de flotte géospatial et gestion de contraintes de priité multiciples.

## EQUIPE
* Matthieu SUCHET
* Axel VANONY
* Maxime BLANC
* Lucas BIGOT
* Matthieu HUMBERT

## Instructions d'installation et d'exécution

Le projet dispose d'un lanceur unifié `demo.py` qui nettoie les ports réseau, initialise les services en arrière-plan et ouvre automatiquement l'application dans votre navigateur.
Pour le lancer il suffit de faire python .\demo.py sur WINDOWS ou python3 demo.py sur Linux ou MacOS
## Prérequis
* **Python 3.10+**
* **Node.js** (incluant `npm`)

## Structure du Rendu

Voici le descriptif détaillé de l'arborescence du projet et le rôle de chaque composant :

```text
.
├── AUTHORS              # Liste des contributeurs du projet
├── README.md            # Instructions et descriptif de la structure du rendu
├── demo.py              # Script de lancement
├── Rapport_ERO1_grp2.pdf# Rapport
├── api/                 # BACKEND
├── src/                 # ALGORITHMES
├── data/                # DONNÉES des 4 secteurs (Outremont, Verdun, Anjou, Riviere)
└── web/                 # FRONTEND 
