const express = require('express');
const router = express.Router();
const { createUser } = require('../controllers/users');

// Route POST pour ajouter un utilisateur
router.post('/users', createUser);

module.exports = router;