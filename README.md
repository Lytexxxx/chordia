# 🎵 Chordia

Application de chat inspirée de Discord pour discuter avec vos amis.

## Installation

1. Installer les dépendances:
```bash
npm install
```

2. Configuration de la base de données PostgreSQL:

**Option A: Déploiement sur Render**
- Créez une base de données PostgreSQL sur Render
- Ajoutez la variable d'environnement `DATABASE_URL` dans les settings de Render
- Redéployez l'application

**Option B: Développement local**
- Installez PostgreSQL sur votre machine
- Créez une base de données nommée `chordia`
- Initialisez le schéma de base de données:
```bash
node init-db.js
```

3. Lancer l'application:
```bash
npm start
```

Ou double-cliquez sur `start.bat`

4. Ouvrir votre navigateur sur: http://localhost:3000

## Déploiement sur Render

1. Connectez votre repository GitHub à Render
2. Créez un nouveau Web Service
3. Configurez les variables d'environnement:
   - `DATABASE_URL`: URL de connexion PostgreSQL (fournie par Render)
4. Déployez

## Fonctionnalités

- ✅ Chat en temps réel
- ✅ Création de salons
- ✅ Liste des utilisateurs en ligne
- ✅ Indicateur de frappe
- ✅ Interface moderne et intuitive
- ✅ Persistance des données avec PostgreSQL
- ✅ Upload d'images de profil et bannières

## Utilisation

1. Entrez votre nom d'utilisateur pour vous connecter
2. Créez ou rejoignez un salon
3. Discutez avec vos amis en temps réel!

## Prochaines fonctionnalités

- 📞 Appels vocaux
- 📹 Appels vidéo
- 📁 Partage de fichiers
