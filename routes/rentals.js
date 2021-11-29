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

  // Check if customer exists
  const customer = await Customer.findById(req.body.customerId);
  if (!customer) return res.status(400).send('Invalid customer.');

  // Check if movie exists
  const movie = await Movie.findById(req.body.movieId);
  if (!movie) return res.status(400).send('Invalid movie.');

  // Start a transaction sing Mongoose's default connection
  // Step 1: Start a Client Session
  const session = await mongoose.startSession();

  // Step 2: Optional. Define options for transaction
  const transactionOptions = {
    readPreference: 'primary',
    readConcern: { level: 'local' },
    writeConcern: { w: 'majority' },
  };

  // Step 3: Use withTransaction() to start a transaction, exetute the callback, and commit (or abort on error)
  // Note: The callback for withTransaction must be async and/or return a Promise.
  try {
    let rental = new Rental({
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

    const transactionResults = await session.withTransaction(async () => {
      // Important:: you must pass the session to each of the operations

      // Save newly created rental in DB
      await rental
        .save({ session })
        .then(() => console.log(`Rental with _id: ${rental._id} was created.`));

      // Check if movie is in stock. If not, abort the transaction.
      if (movie.numberInStock === 0) {
        await session.abortTransaction();
        console.error(
          'Movie not currently in stock. The new rental could not be created.'
        );
        console.error(
          'Any operations that already ocurred as a part of this transaction will be rolled back.'
        );
        return;
      }

      const movieUpdateResults = await Movie.updateOne(
        { _id: rental.movie._id },
        {
          $inc: { numberInStock: -1 },
        },
        { session }
      );

      console.log(
        `${movieUpdateResults.matchedCount} document(s) found in the movies collection with the name ${rental.movie.title}`
      );

      console.log(
        `${movieUpdateResults.modifiedCount} document(s) was/were updated substract a unit in stock.`
      );
    }, transactionOptions);

    if (transactionResults) {
      console.log('The rental was successfully created.');
      res.send(rental);
    } else {
      console.log('The transaction was intentionally aborted.');
      res.status(400).send('Movie not in stock.');
    }
  } catch (ex) {
    console.error(ex.message);
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
