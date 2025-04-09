const pool = require('../config/db'); // Importation de la configuration PostgreSQL

// Fonction pour insérer un utilisateur
exports.createUser = async (req, res) => {
  const { name, email } = req.body; // Récupérer les données du corps de la requête
  if (!name || !email) {
    return res.status(400).json({ error: 'Les champs name et email sont requis.' });
  }

  try {
    // Insérer les données dans PostgreSQL
    const result = await pool.query(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
      [name, email] // Échapper les paramètres pour éviter les injections SQL
    );

    // Réponse de succès
    res.status(201).json({
      message: 'Utilisateur ajouté avec succès !',
      user: result.rows[0],
    });
  } catch (err) {
    // Gestion des erreurs
    res.status(500).json({ error: err.message });
  }
};