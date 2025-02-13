const auth = require('../middleware/auth');
const bcrypt = require('bcrypt');
const { User, validate } = require('../models/user');
const express = require('express');
const router = express.Router();

// Get current user
router.get('/me', auth, async (req, res) => {
  const user = await User.findById(req.body._id).select('-password');

  res.send(user);
});

// Create a new user
router.post('/', async (req, res) => {
  const { error } = validate(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  let user = await User.findOne({ email: req.body.email });
  if (user) return res.status(400).send('User already registered.');

  const { name, email, password } = req.body;

  user = new User({ name, email, password });
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(user.password, salt);
  await user.save();

  const token = user.generateAuthToken();

  const { password: pass, ...rest } = user.toObject();

  res
    .status(201)
    .header('x-auth-token', token)
    .send({ ...rest });
});

module.exports = router;
