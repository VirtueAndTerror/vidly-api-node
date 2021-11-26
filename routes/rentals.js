const { Rental, validate } = require('../models/rental');
const { Movie } = require('../models/movie');
const { Customer } = require('../models/customer');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');
const express = require('express');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  const rentals = await Rental.find().select('-__v').sort('-dateOut');
  res.send(rentals);
});

// Create
router.post('/', auth, async (req, res) => {
  const { error } = validate(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  //Chech if customer exists
  const customer = await Customer.findById(req.body.customerId);
  if (!customer) return res.status(400).send('Invalid customer.');

  // Check if movie exists
  const movie = await Movie.findById(req.body.movieId);
  if (!movie) return res.status(400).send('Invalid movie.');

  // Check if movie is in stock
  if (movie.numberInStock === 0)
    return res.status(400).send('Movie not in stock.');

  // Start a transaction sing Mongoose's default connection
  // Step 1: Start a Client Session
  const session = await mongoose.startSession();

  // Step 2: Optional. Define options for transaction
  const transactionOptions = {
    readPreference: 'primary',
    readConcern: { level: 'local' },
    writeConcern: { w: 'majority' },
  };

  try {
    const transactionResults = await session.withTransaction(async () => {
      let rental = await new Rental({
        customer: {
          _id: customer._id,
          name: customer.name,
          phone: customer.phone,
        },
        movie: {
          _id: movie._id,
          title: movie.title,
          dailyRentalRate: movie.dailyRentalRate,
        },
      });

      await rental.save({ session });

      await Movie.updateOne(
        { _id: rental.movie._id },
        {
          $inc: { numberInStock: -1 },
        },
        { session }
      );
    }, transactionOptions);

    if (transactionResults) {
      console.log('The resental was successfully created.');
    } else {
      console.log('The transaction was intentionally aborted.');
    }

    res.send(rental);
  } catch (ex) {
    res.status(500).send('Something failed.');
  } finally {
    await session.endSession();
  }
});

router.get('/:id', [auth], async (req, res) => {
  const rental = await Rental.findById(req.params.id).select('-__v');

  if (!rental)
    return res.status(404).send('The rental with the given ID was not found.');

  res.send(rental);
});

module.exports = router;
