# 🗳️ Sistema de Votación Electrónica para Municipio Escolar (Red Local LAN)

Sistema completo de votación electrónica y monitoreo en tiempo real diseñado para elecciones escolares en redes de área local (LAN) de colegios e institutos. Permite habilitar múltiples cabinas de votación para los estudiantes en las computadoras del aula de innovación o cómputo, centralizando los sufragios de forma segura en un servidor principal operado por el Comité Electoral o docente asesor.

---

## 🌟 Características Principales

### 1. 🖥️ Cabina de Votación (Para las PCs de los Alumnos)
* **Diseño visual atractivo e intuitivo:** Tarjetas modernas con fotografías vectoriales de los candidatos, distintivos de colores oficiales por lista, propuestas de campaña y equipo de regidores.
* **Cédula Oficial:** Incluye todas las listas inscritas más las opciones democráticas de **Voto en Blanco** y **Voto Nulo**.
* **Validación de Identidad de Uso Único:** Validación por Código de Estudiante o DNI. Una vez que el alumno vota, su código queda invalidado inmediatamente en el padrón electoral central impidiendo doble voto.
* **Teclado Numérico Virtual en Pantalla:** Ideal para monitores táctiles o tablets, además de soporte para teclado físico.
* **Modal de Confirmación de Voto:** Muestra la foto y nombre de la lista elegida para evitar votos por error.
* **Pantalla de Agradecimiento y Reinicio Automático:** Animación festiva de confeti, agradecimiento cívico y temporizador regresivo de 5 segundos con barra de progreso que reinicia la cabina para el siguiente elector.
* **Bloqueo de Emergencia Dinámico:** Si el docente pausa las elecciones, todas las pantallas de los estudiantes se bloquean instantáneamente en tiempo real.

### 2. 🎛️ Panel de Control y Servidor Central (Para el Docente / Comité Electoral)
* **Dashboard en Tiempo Real:** Métricas sincronizadas vía WebSockets (Socket.io) sin necesidad de recargar la página:
  * Total de estudiantes en el Padrón.
  * Total de votos emitidos.
  * Porcentaje y barra de participación electoral.
  * Alumnos pendientes por sufragar.
* **Gráficos Dinámicos (Chart.js):**
  * Gráfico de barras interactivo con los votos en tiempo real por cada lista.
  * Gráfico de dona con la distribución de Votos Válidos vs. Votos en Blanco vs. Votos Nulos.
* **Auditoría de Flujo en Directo:** Registro cronológico de votos emitidos (hora, IP de la cabina y grado), respetando rigurosamente el **secreto del voto**.
* **Gestión del Padrón Electoral:** Búsqueda en vivo por DNI o nombre, filtros (Todos / Ya votaron / Pendientes), registro de nuevos alumnos y generador de alumnos de prueba.
* **Botones de Seguridad y Control:**
  * **Pausar / Reanudar Votaciones:** Bloquea o reactiva todas las computadoras de votación con un solo clic.
  * **Reiniciar Elecciones a Cero:** Permite resetear la elección borrando los votos con confirmación por contraseña.
  * **Exportación en CSV:** Descarga los resultados consolidados y el padrón de asistencia para Microsoft Excel.
  * **Acta Oficial de Escrutinio Imprimible:** Genera el documento formal listo para imprimir o guardar en PDF con secciones de firma para el Comité Electoral y la Dirección del colegio.

---

## 📂 Estructura del Proyecto

```
municipio-escolar/
├── package.json              # Configuración y dependencias (Express, Socket.io, CORS)
├── server.js                 # Servidor HTTP y WebSockets configurado para red LAN (0.0.0.0)
├── README.md                 # Manual de instalación y operación
├── data/                     # Base de datos ligera y persistente en JSON
│   ├── election_config.json  # Nombre de la I.E., título, estado y clave de admin
│   ├── candidates.json       # Listas, candidatos, colores, fotos y propuestas
│   ├── padron.json           # Padrón de estudiantes (DNI, nombre, grado, ha_votado)
│   └── votes.json            # Registro anónimo de votos emitidos
├── src/
│   ├── db.js                 # Capa de datos con escrituras atómicas (protección contra cortes)
│   └── routes.js             # API REST (validación, sufragio, auditoría, exportaciones)
└── public/                   # Frontend estático limpio y responsivo
    ├── index.html            # Pantalla de votación del estudiante (Cabina)
    ├── admin.html            # Panel de monitoreo del docente / servidor
    ├── acta.html             # Acta oficial de escrutinio (formato A4/Carta para imprimir/PDF)
    ├── css/
    │   └── custom.css        # Animaciones, efectos visuales y estilos de impresión
    ├── js/
    │   ├── vote.js           # Lógica de la cabina, teclado táctil, temporizador y confeti
    │   └── admin.js          # Lógica del panel, gráficos en vivo y sockets
    └── assets/
        └── candidates/       # Avatares vectoriales SVG de los candidatos y votos especiales
```

---

## 🚀 Guía de Inicio Rápido

### Requisitos Previos
* Tener instalado **Node.js** (versión 18 o superior).

### 1. Iniciar el Servidor Principal en la "PC Nodriza" (Docente)
Abre una terminal (PowerShell o CMD) en la carpeta del proyecto y ejecuta:

```bash
# 1. Instalar dependencias (solo la primera vez)
npm install

# 2. Iniciar el servidor
npm start
# o alternativamente: node server.js
```

Al iniciar, el servidor detectará automáticamente la dirección IP local de la computadora en la red del colegio y mostrará un mensaje como este:

```text
================================================================
   SISTEMA DE ELECCIONES DEL MUNICIPIO ESCOLAR (RED LOCAL LAN)  
================================================================
 Servidor local activo en:
   - En este equipo (Servidor): http://localhost:3000

 Para las computadoras de los estudiantes en la red escolar (LAN):
   - http://192.168.1.50:3000  (Pantalla de votación para alumnos)
   - http://192.168.1.50:3000/admin.html (Panel de Control y Monitoreo)
================================================================
 Estado de las votaciones: OPEN
 Clave de Administrador por defecto: "admin"
================================================================
```

---

## 🌐 Cómo Conectar las Computadoras de los Estudiantes

1. Asegúrate de que todas las computadoras (tanto la del docente como las de los alumnos) estén conectadas a la misma red (mismo switch, router o red WiFi del colegio).
2. En las computadoras de los alumnos, abre cualquier navegador web moderno (Google Chrome, Microsoft Edge, Firefox).
3. Escribe en la barra de direcciones la IP que mostró el servidor principal, por ejemplo:
   ```text
   http://192.168.1.50:3000
   ```
4. **💡 Consejo de Modo Cabina (Kiosco):** Presiona la tecla **F11** en el teclado de la PC del alumno para poner el navegador en **Pantalla Completa**. Esto evitará distracciones y dará la experiencia de una cabina de votación electrónica real.

> **Nota sobre el Firewall de Windows en la PC Servidor:**  
> La primera vez que ejecutes `node server.js`, Windows Defender mostrará una alerta preguntando si deseas permitir la conexión a redes privadas. Marca la casilla **"Permitir acceso en redes privadas"**.  
> Si las computadoras de los alumnos no pueden cargar la página, asegúrate de permitir el puerto `3000` en el Firewall de Windows.

---

## 🔑 Credenciales y Configuración

* **Contraseña de Administrador:** `admin` (se puede modificar en el archivo `data/election_config.json`).
* **Códigos de Prueba Rápidos (para probar la votación):**
  * `1001` (Estudiante Demo 1)
  * `1002` (Estudiante Demo 2)
  * `1003` (Estudiante Demo 3)
  * O cualquier DNI de la lista: `70010001`, `70010002`, `70020001`, `70030001`, etc.

---

## 📋 Personalización de las Elecciones

### Cambiar Nombre del Colegio y Título
Edita el archivo `data/election_config.json`:
```json
{
  "electionTitle": "Elecciones del Municipio Escolar 2026 - 2027",
  "schoolName": "Tu Colegio Aquí",
  "status": "open",
  "adminPassword": "tu_nueva_clave",
  "allowBlank": true,
  "allowNull": true
}
```

### Configurar Listas y Candidatos
Edita el archivo `data/candidates.json` para cambiar los nombres de las listas, candidatos a Alcalde, Teniente Alcalde, regidores y sus propuestas de campaña.

### Cargar el Padrón de Alumnos del Colegio
Puedes agregar alumnos uno a uno desde la pestaña **"Padrón Electoral"** en el Panel de Control, o reemplazar el contenido de `data/padron.json` con la lista de tus estudiantes.

---

## 🔒 Mecanismos de Seguridad y Transparencia

1. **Voto Secreto y Anónimo:** El padrón electoral registra únicamente si el alumno ya sufragó (`hasVoted: true`) y la hora. La tabla de votos se almacena de forma independiente sin asociar el código del estudiante a la lista por la que votó, garantizando el secreto constitucional del voto.
2. **Escrituras Atómicas a Disco:** El sistema utiliza escrituras en archivos temporales con renombrado atómico (`fs.renameSync`). Si ocurriera un corte de energía eléctrica en el colegio, no se perderá ni dañará la base de datos de votos ya registrados.
3. **Control de Doble Sufragio:** Al emitir el voto, la validación se ejecuta en el backend en una transacción sincronizada; cualquier intento subsiguiente con el mismo código es rechazado con el mensaje de que el elector ya participó.
