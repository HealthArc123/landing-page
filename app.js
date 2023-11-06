const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');

const app = express();
const port = 3000;

app.use(bodyParser.json());

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'landing_page',
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
  } else {
    console.log('Connected to MySQL database');
  }
});

// API endpoint to receive device data
app.post('/api/receive-data', (req, res) => {
  const { serial_number, reading_data } = req.body;

  // Map the device's serial number to the appropriate patient_device_id
  const mappingQuery = 'SELECT id FROM patient_device_map WHERE serial_number = ?';

  db.query(mappingQuery, [serial_number], (error, results) => {
    if (error) {
      console.error('Error:', error);
      res.status(500).json({ message: 'An error occurred while processing the request.' });
    } else if (results.length > 0) {
      const patientDeviceId = results[0].id;

      // Save the reading with the patient_device_id
      const recordedDttm = new Date();
      const insertQuery = 'INSERT INTO readings (patient_device_id, recorded_dttm, reading_data) VALUES (?, ?, ?)';
      db.query(insertQuery, [patientDeviceId, recordedDttm, JSON.stringify(reading_data)], (insertError) => {
        if (insertError) {
          console.error('Error:', insertError);
          res.status(500).json({ message: 'An error occurred while processing the request.' });
        } else {
          res.status(201).json({ message: 'Reading data received and mapped to a patient device.' });
        }
      });
    } else {
      res.status(404).json({ message: 'Device not found or not mapped to a patient device.' });
    }
  });
});

app.get('/patient/device/:patient_device_id/reading/avg', (req, res) => {
  // Extract the patient_device_id from the request URL
  const patient_device_id = req.params.patient_device_id;

  // SQL query to calculate the average reading for each device
  const sql = `
    SELECT d.device_name, AVG(JSON_UNQUOTE(JSON_EXTRACT(r.reading_data, "$.value"))) as avg_reading
    FROM devices d
    JOIN patient_device_map pdm ON d.id = pdm.device_id
    JOIN readings r ON pdm.id = r.patient_device_id
    WHERE pdm.patient_id = ?
    GROUP BY d.device_name
  `;

  db.query(sql, [patient_device_id], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'No data found for the specified patient_device_id' });
    }

    res.json(results);
  });
});


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
