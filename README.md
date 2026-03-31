# Backend Galería de Imágenes con Cloudinary

Backend simple en Node.js para gestionar galerías de imágenes utilizando URLs de Cloudinary. Perfecto para crear un CRUD completo que permita organizar hasta 30 fotos por galería con título, fecha y descripción.

## 🚀 Características

- ✅ CRUD completo para galerías de imágenes
- ✅ Integración con URLs de Cloudinary
- ✅ Validación robusta de datos
- ✅ Soporte para hasta 30 imágenes por galería
- ✅ Sistema de tags y búsqueda
- ✅ Paginación y filtrado
- ✅ Manejo de errores comprehensivo
- ✅ Estructura modular y escalable

## 📋 Requisitos Previos

- Node.js (versión 16 o superior)
- MongoDB (local o en la nube)
- Cuenta de Cloudinary (para obtener las URLs de imágenes)

## 🛠️ Instalación

1. **Clona o crea el proyecto:**
```bash
mkdir gallery-backend
cd gallery-backend
npm init -y
```

2. **Instala las dependencias:**
```bash
npm install express mongoose cors dotenv cloudinary multer joi
npm install --save-dev nodemon
```

3. **Configura las variables de entorno:**
```bash
cp .env.example .env
```

Edita el archivo `.env` con tus configuraciones:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/gallery
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```

4. **Inicia el servidor:**
```bash
# Desarrollo
npm run dev

# Producción
npm start
```

## 📁 Estructura del Proyecto

```
gallery-backend/
├── models/
│   └── Gallery.js          # Modelo de datos de la galería
├── routes/
│   └── gallery.js          # Rutas de la API
├── middleware/
│   └── validation.js       # Middleware de validación
├── utils/
│   └── cloudinaryHelper.js # Utilidades para Cloudinary
├── server.js               # Servidor principal
├── package.json
├── .env.example
└── README.md
```

## 🎯 Endpoints de la API

### Galerías

#### `GET /api/galleries`
Obtiene todas las galerías con paginación y filtros.

**Parámetros de consulta:**
- `page` (opcional): Número de página (default: 1)
- `limit` (opcional): Items por página (default: 10, max: 100)
- `sort` (opcional): Ordenamiento (createdAt, -createdAt, title, -title, date, -date)
- `search` (opcional): Búsqueda por texto
- `isActive` (opcional): Filtrar por estado (true, false, all)
- `tags` (opcional): Filtrar por tags (separados por coma)

**Ejemplo:**
```bash
GET /api/galleries?page=1&limit=5&sort=-date&search=vacaciones&tags=playa,verano
```

#### `GET /api/galleries/:id`
Obtiene una galería específica por ID.

#### `POST /api/galleries`
Crea una nueva galería.

**Body:**
```json
{
  "title": "Mi Galería de Vacaciones",
  "description": "Fotos de mis vacaciones en la playa",
  "date": "2024-08-15",
  "images": [
    "https://res.cloudinary.com/tu-cloud/image/upload/v1234567890/imagen1.jpg",
    {
      "url": "https://res.cloudinary.com/tu-cloud/image/upload/v1234567890/imagen2.jpg",
      "description": "Atardecer en la playa"
    }
  ],
  "tags": ["vacaciones", "playa", "verano"],
  "coverImage": "https://res.cloudinary.com/tu-cloud/image/upload/v1234567890/portada.jpg"
}
```

#### `PUT /api/galleries/:id`
Actualiza una galería existente.

#### `DELETE /api/galleries/:id`
Elimina una galería.

### Imágenes

#### `POST /api/galleries/:id/images`
Agrega una imagen a una galería existente.

**Body:**
```json
{
  "url": "https://res.cloudinary.com/tu-cloud/image/upload/v1234567890/nueva-imagen.jpg",
  "description": "Descripción de la nueva imagen"
}
```

#### `DELETE /api/galleries/:id/images/:publicId`
Elimina una imagen específica de una galería.

## 📝 Modelo de Datos

### Galería
```javascript
{
  title: String,           // Título de la galería (requerido, max: 100 chars)
  description: String,     // Descripción (opcional, max: 500 chars)
  date: Date,             // Fecha de la galería (requerido)
  images: [{              // Array de imágenes (max: 30)
    url: String,          // URL de Cloudinary
    publicId: String,     // ID público de Cloudinary
    description: String,  // Descripción de la imagen
    order: Number        // Orden de la imagen
  }],
  coverImage: String,     // Imagen de portada
  isActive: Boolean,      // Estado activo/inactivo
  tags: [String],        // Tags para categorización
  createdAt: Date,       // Fecha de creación
  updatedAt: Date        // Fecha de última actualización
}
```

## 🔧 Utilidades de Cloudinary

El helper de Cloudinary incluye funciones útiles para:

- **Validación de URLs:** Verifica que las URLs sean válidas de Cloudinary
- **Extracción de datos:** Obtiene cloud_name, public_id, formato, etc.
- **Generación de transformaciones:** Crea diferentes tamaños (thumbnail, medium, large)
- **Optimización:** Mejora URLs para web con calidad y formato automático
- **Procesamiento por lotes:** Maneja múltiples URLs simultáneamente

**Ejemplo de uso:**
```javascript
const { isValidCloudinaryUrl, extractCloudinaryData } = require('./utils/cloudinaryHelper');

// Validar URL
const isValid = isValidCloudinaryUrl('https://res.cloudinary.com/demo/image/upload/sample.jpg');

// Extraer datos
const data = extractCloudinaryData('https://res.cloudinary.com/demo/image/upload/sample.jpg');
console.log(data.publicId); // 'sample'
```

## ⚡ Respuestas de la API

Todas las respuestas siguen el formato estándar:

### Éxito
```json
{
  "success": true,
  "data": { /* datos solicitados */ },
  "message": "Operación exitosa",
  "pagination": { /* info de paginación si aplica */ }
}
```

### Error
```json
{
  "success": false,
  "error": "Descripción del error",
  "details": [ /* detalles adicionales si los hay */ ]
}
```

## 🛡️ Validaciones

- **Título:** Requerido, 1-100 caracteres
- **Descripción:** Opcional, máximo 500 caracteres
- **Imágenes:** Máximo 30 por galería, deben ser URLs válidas de Cloudinary
- **Tags:** Máximo 10, cada uno con máximo 50 caracteres
- **Fecha:** Formato ISO válido

## 📊 Ejemplos de Uso

### Crear una galería simple
```bash
curl -X POST http://localhost:5000/api/galleries \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Galería de Prueba",
    "description": "Mi primera galería",
    "images": [
      "https://res.cloudinary.com/demo/image/upload/sample.jpg",
      "https://res.cloudinary.com/demo/image/upload/w_400/sample.jpg"
    ]
  }'
```

### Obtener galerías con filtros
```bash
curl "http://localhost:5000/api/galleries?page=1&limit=5&sort=-date&isActive=true"
```

### Agregar imagen a galería existente
```bash
curl -X POST http://localhost:5000/api/galleries/GALLERY_ID/images \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://res.cloudinary.com/demo/image/upload/another-sample.jpg",
    "description": "Nueva imagen agregada"
  }'
```

## 🚀 Próximos Pasos

Con este backend ya tienes la base para:

1. **Crear un frontend:** React, Vue, Angular, etc.
2. **Implementar autenticación:** JWT, OAuth, etc.
3. **Agregar funcionalidades:** 
   - Upload directo a Cloudinary
   - Sistema de comentarios
   - Compartir galerías
   - Estadísticas de visualización

## 🤝 Contribución

Este es un backend base que puedes expandir según tus necesidades. Algunas ideas:

- Agregar autenticación y autorización
- Implementar caching con Redis
- Añadir tests unitarios e integración
- Documentación con Swagger
- Rate limiting
- Logging avanzado

## 📄 Licencia

MIT - Puedes usar este código libremente en tus proyectos.