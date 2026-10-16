const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const os = require('os');
const db = require('./src/db');
const createRouter = require('./src/routes');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Mount API routes
app.use('/api', createRouter(io));

// Fallback for SPA routing if needed
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/acta', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'acta.html'));
});

// Socket.io real-time connection management
io.on('connection', (socket) => {
  console.log(`[Socket] Nuevo cliente conectado: ${socket.id} (IP: ${socket.handshake.address})`);

  // Send initial data to newly connected client
  socket.emit('initial_state', {
    status: db.getConfig().status,
    stats: db.getStats()
  });

  socket.on('disconnect', () => {
    // Client disconnected
  });
});

// Get local LAN IPv4 addresses
function getLanAddresses() {
  const interfaces = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        results.push(iface.address);
      }
    }
  }
  return results;
}

// Start Server on 0.0.0.0 for LAN access
server.listen(PORT, '0.0.0.0', () => {
  const lanIps = getLanAddresses();
  console.log('================================================================');
  console.log('   SISTEMA DE ELECCIONES DEL MUNICIPIO ESCOLAR (RED LOCAL LAN)  ');
  console.log('================================================================');
  console.log(` Servidor local activo en:`);
  console.log(`   - En este equipo (Servidor): http://localhost:${PORT}`);
  if (lanIps.length > 0) {
    console.log(`\n Para las computadoras de los estudiantes en la red escolar (LAN):`);
    lanIps.forEach(ip => {
      console.log(`   - http://${ip}:${PORT}  (Pantalla de votación para alumnos)`);
      console.log(`   - http://${ip}:${PORT}/admin.html (Panel de Control y Monitoreo)`);
    });
  } else {
    console.log(`   (No se detectaron adaptadores LAN activos adicionales)`);
  }
  console.log('================================================================');
  console.log(' Estado de las votaciones: ' + db.getConfig().status.toUpperCase());
  console.log(' Clave de Administrador por defecto: "admin"');
  console.log('================================================================\n');
});
