const express = require('express');
const cors = require('cors');

const app = express();

// Middlewares
app.use(express.json());
app.use(cors()); // Permite que tu frontend se comunique con este backend

// Ruta de prueba para verificar que el servidor vive
app.get('/', (req, res) => {
    res.json({ mensaje: "¡El backend de Ajolote y Grulla está activo!" });
});

// Ruta provisional para el formulario de recuperar contraseña
app.post('/api/recuperar', (req, res) => {
    const { email } = req.body;
    console.log("Petición de recuperación recibida para:", email);
    
    // Aquí después pondremos la lógica para conectar la base de datos y Nodemailer
    res.json({ ok: true, mensaje: "Si el correo existe, se enviarán las instrucciones." });
});

// Render asigna un puerto automático mediante process.env.PORT, si no, usa el 3000 local
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
