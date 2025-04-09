const express = require('express');
const cors = require('cors');
require('dotenv').config();
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const { check, validationResult } = require('express-validator');

// Swagger dependencies
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

//
// === Configuration de la base de données PostgreSQL ===
//
const pool = new Pool({
  user: process.env.PG_USER || 'espoir',
  host: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DATABASE || 'agri_solution',
  password: process.env.PG_PASSWORD || 'Es1@2002',
  port: process.env.PG_PORT || 5432,
});

const app = express();

//
// === Middlewares de base ===
//
app.use(express.json());
app.use(cors());

// Sécurité avec Helmet
app.use(helmet());

// Limitation des requêtes (Rate Limiting)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limite chaque IP à 100 requêtes par window
  message: "Trop de requêtes, veuillez réessayer plus tard.",
});
app.use(limiter);

//
// === Configuration de Swagger pour la documentation ===
//
const swaggerOptions = {
  swaggerDefinition: {
    openapi: "3.0.0",
    info: {
      title: "API agri_solution",
      version: "1.0.0",
      description: "Documentation de l'API agri_solution",
    },
    servers: [
      {
        url: "http://localhost:" + (process.env.PORT || "5000"),
      },
    ],
  },
  apis: ["./server.js"], // ce fichier contient les annotations Swagger
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

//
// === Routes ===
//

/**
 * @swagger
 * /:
 *   get:
 *     summary: Message de test du serveur
 *     responses:
 *       200:
 *         description: Serveur opérationnel, retourne un message de succès.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: Le serveur tourne bien ! 🚀
 */
app.get('/', (req, res) => {
  res.send('Le serveur tourne bien ! 🚀');
});

//
// --- Routes pour les utilisateurs ---
//

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Récupère tous les utilisateurs
 *     responses:
 *       200:
 *         description: Liste des utilisateurs.
 */
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users');
    res.status(200).json({ users: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Ajoute un nouvel utilisateur
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *             required:
 *               - name
 *               - email
 *     responses:
 *       201:
 *         description: Utilisateur ajouté avec succès.
 */
app.post(
  '/api/users',
  [
    check('name', 'Le nom est requis').trim().not().isEmpty(),
    check('email', 'Un email valide est requis').isEmail().normalizeEmail(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { name, email } = req.body;
    try {
      const dup = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      if (dup.rows.length > 0) {
        return res.status(400).json({ error: "Cet email est déjà utilisé." });
      }

      const result = await pool.query(
        'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
        [name, email]
      );
      res.status(201).json({ message: 'Utilisateur ajouté avec succès !', user: result.rows[0] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

/**
 * @swagger
 * /api/users:
 *   put:
 *     summary: Met à jour un utilisateur existant
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *             required:
 *               - id
 *               - name
 *               - email
 *     responses:
 *       200:
 *         description: Utilisateur mis à jour avec succès.
 */
app.put('/api/users', async (req, res) => {
  const { id, name, email } = req.body;
  if (!id || !name || !email) {
    return res.status(400).json({ error: 'Les champs id, name et email sont requis.' });
  }
  try {
    const result = await pool.query(
      'UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING *',
      [name, email, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    }
    res.status(200).json({ message: 'Utilisateur mis à jour avec succès !', user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/users:
 *   delete:
 *     summary: Supprime un utilisateur existant
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *             required:
 *               - id
 *     responses:
 *       200:
 *         description: Utilisateur supprimé avec succès.
 */
app.delete('/api/users', async (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: "L'ID de l'utilisateur est requis." });
  }
  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    }
    res.status(200).json({ message: 'Utilisateur supprimé avec succès !', user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// --- Routes pour les produits ---
//

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Récupère tous les produits
 *     responses:
 *       200:
 *         description: Liste des produits récupérée.
 */
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products');
    res.status(200).json({ products: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Ajoute un nouveau produit
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *               stock:
 *                 type: number
 *             required:
 *               - name
 *               - price
 *               - stock
 *     responses:
 *       201:
 *         description: Produit ajouté avec succès.
 */
app.post('/api/products', async (req, res) => {
  const { name, price, stock } = req.body;
  if (!name || !price || stock === undefined) {
    return res.status(400).json({ error: 'Les champs name, price et stock sont requis.' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO products (name, price, stock) VALUES ($1, $2, $3) RETURNING *',
      [name, price, stock]
    );
    res.status(201).json({ message: 'Produit ajouté avec succès !', product: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/products:
 *   put:
 *     summary: Met à jour un produit existant
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *               stock:
 *                 type: number
 *             required:
 *               - id
 *               - name
 *               - price
 *               - stock
 *     responses:
 *       200:
 *         description: Produit mis à jour avec succès.
 */
app.put('/api/products', async (req, res) => {
  const { id, name, price, stock } = req.body;
  if (!id || !name || !price || stock === undefined) {
    return res.status(400).json({ error: 'Les champs id, name, price et stock sont requis.' });
  }
  try {
    const result = await pool.query(
      'UPDATE products SET name = $1, price = $2, stock = $3 WHERE id = $4 RETURNING *',
      [name, price, stock, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Produit non trouvé.' });
    }
    res.status(200).json({ message: 'Produit mis à jour avec succès !', product: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/products:
 *   delete:
 *     summary: Supprime un produit existant
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *             required:
 *               - id
 *     responses:
 *       200:
 *         description: Produit supprimé avec succès.
 */
app.delete('/api/products', async (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: "L'ID du produit est requis." });
  }
  try {
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Produit non trouvé.' });
    }
    res.status(200).json({ message: 'Produit supprimé avec succès !', product: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// --- Routes pour les commandes ---
//

/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: Récupère toutes les commandes
 *     responses:
 *       200:
 *         description: Liste des commandes récupérée.
 */
app.get('/api/orders', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders');
    res.status(200).json({ orders: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Crée une nouvelle commande
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               user_id:
 *                 type: integer
 *               total_price:
 *                 type: number
 *               status:
 *                 type: string
 *             required:
 *               - user_id
 *               - total_price
 *     responses:
 *       201:
 *         description: Commande créée avec succès !
 */
app.post('/api/orders', async (req, res) => {
  const { user_id, total_price, status } = req.body;
  if (!user_id || !total_price) {
    return res.status(400).json({ error: 'Les champs user_id et total_price sont requis.' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO orders (user_id, total_price, status) VALUES ($1, $2, $3) RETURNING *',
      [user_id, total_price, status || 'pending']
    );
    res.status(201).json({ message: 'Commande créée avec succès !', order: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/orders:
 *   put:
 *     summary: Met à jour une commande existante
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               status:
 *                 type: string
 *             required:
 *               - id
 *               - status
 *     responses:
 *       200:
 *         description: Commande mise à jour avec succès.
 */
app.put('/api/orders', async (req, res) => {
  const { id, status } = req.body;
  if (!id || !status) {
    return res.status(400).json({ error: 'Les champs id et status sont requis.' });
  }
  try {
    const result = await pool.query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée.' });
    }
    res.status(200).json({ message: 'Commande mise à jour avec succès !', order: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/orders:
 *   delete:
 *     summary: Supprime une commande existante
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *             required:
 *               - id
 *     responses:
 *       200:
 *         description: Commande supprimée avec succès !
 */
app.delete('/api/orders', async (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: "L'ID de la commande est requis." });
  }
  try {
    const result = await pool.query('DELETE FROM orders WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée.' });
    }
    res.status(200).json({ message: 'Commande supprimée avec succès !', order: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// --- Route d'authentification ---
//

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authentifie l'utilisateur ESPOIR avec le mot de passe "chou"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *             required:
 *               - username
 *               - password
 *     responses:
 *       200:
 *         description: Authentification réussie.
 */
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Le nom d’utilisateur et le mot de passe sont requis.' });
  }
  
  // Pour cet exemple, nous vérifions simplement si l'utilisateur correspond à ESPOIR et si le mot de passe est "chou"
  if (username === 'ESPOIR' && password === 'chou') {
    return res.status(200).json({ message: 'Authentification réussie !', user: { username } });
  } else {
    return res.status(401).json({ error: 'Identifiants invalides.' });
  }
});





// Endpoint pour obtenir la liste de tous les paiements
app.get('/api/payments', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM payments ORDER BY id ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des paiements', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Endpoint pour obtenir un paiement par ID
app.get('/api/payments/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const { rows } = await pool.query('SELECT * FROM payments WHERE id = $1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Paiement non trouvé' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Erreur lors de la récupération du paiement', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Endpoint pour créer un nouveau paiement
app.post('/api/payments', async (req, res) => {
  const { order_id, amount, payment_method } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO payments (order_id, amount, payment_method)
       VALUES ($1, $2, $3) RETURNING *`,
      [order_id, amount, payment_method]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Erreur lors de la création du paiement', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Endpoint pour mettre à jour le statut d'un paiement
app.put('/api/payments/:id', async (req, res) => {
  const id = req.params.id;
  const { status } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE payments SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Paiement non trouvé' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Erreur lors de la mise à jour du paiement', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Endpoint pour supprimer un paiement
app.delete('/api/payments/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query('DELETE FROM payments WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Paiement non trouvé' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Erreur lors de la suppression du paiement', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});


//
// === Démarrage du serveur ===
//
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur le port ${PORT}`);
});