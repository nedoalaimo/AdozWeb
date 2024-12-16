# AdozWeb Application

A web-based application for managing and highlighting state information.

## Setup & Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/AdozWeb.git
cd AdozWeb
```

2. Install dependencies
```bash
pip install -r requirements.txt
```

3. Run the application
```bash
python app.py
```

The application will be available at `http://localhost:5000`

## Deployment

This application can be deployed to Heroku:

1. Create a Heroku account at https://heroku.com
2. Install Heroku CLI
3. Login to Heroku CLI:
```bash
heroku login
```
4. Create a new Heroku app:
```bash
heroku create your-app-name
```
5. Push to Heroku:
```bash
git push heroku main
```

## Features

- State information management
- Text highlighting functionality
- JSON-based state markings
- Interactive web interface

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/YourFeature`)
3. Commit your changes (`git commit -m 'Add some feature'`)
4. Push to the branch (`git push origin feature/YourFeature`)
5. Create a new Pull Request
