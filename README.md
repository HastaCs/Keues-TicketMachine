# Keues TicketMachine 🎫

[![Version](https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/HastaCs/Keues-TicketMachine/main/package.json&query=$.version&label=Version&color=blue)](https://github.com/HastaCs/Keues-TicketMachine)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**English version available:** [README.en.md](README.en.md)

Keues TicketMachine es el **kiosco físico de autoservicio** del sistema de gestión de turnos **Keues**. Es la máquina que el cliente usa para elegir un servicio y sacar su número de turno, que se imprime al instante.

Sitio web oficial y documentación: **[https://www.keues.dev](https://www.keues.dev)**

> ⚠️ **Importante:** la máquina no funciona sola. Necesita un servidor para conectarse y emitir turnos (ver [Requisitos](#requisitos-previos-)).

---

## 🖥️ Para el cliente

Usar la máquina es muy sencillo:

1. La pantalla muestra el **menú de servicios** del establecimiento.
2. El cliente toca el servicio que necesita (si hay submenús, navega con el botón **"Atrás"**).
3. La máquina genera su **número de turno** y lo muestra en pantalla.
4. El turno se **imprime** automáticamente en la impresora.
5. A los 2 segundos la pantalla vuelve al menú principal, lista para el siguiente cliente.

---

## 🏪 Para el negocio

### Requisitos previos ⚠️

- Un **servidor Keues** ([Keues](https://github.com/HastaCs/Keues)) desplegado y accesible desde la misma red que la máquina. El servidor es el que gestiona las colas, los turnos y los flujos de servicio; sin él la máquina no puede emitir tickets.
- Una **pantalla** (idealmente táctil) para el kiosco.
- Una **impresora** de tickets (térmica POS o cualquier impresora del sistema).

### Instalación ⬇️

No necesitas compilar nada. Cada [release de GitHub](https://github.com/HastaCs/Keues-TicketMachine/releases) incluye un instalador `.exe` para Windows:

1. Descarga el archivo `Keues-TicketMachine-Setup-X.Y.Z.exe`.
2. Ejecútalo y sigue los pasos del instalador.
3. La máquina queda instalada y lista para configurar.

### Configuración inicial ⚙️

Al abrir la aplicación por primera vez, se muestra la pantalla de **ajustes de la máquina**:

1. Introduce la **dirección del servidor** Keues y pulsa **Conectar**.
2. Selecciona la **ubicación** (establecimiento).
3. Selecciona el **flujo** de servicios.
4. Asigna un **nombre** a la máquina.
5. Elige el **tema visual** (opcional).

Guarda los ajustes y la máquina cargará el menú de servicios y empezará a atender clientes.

### Impresora 🖨️

Desde los ajustes puedes configurar la impresión:

- **Seleccionar impresora**: elige entre las impresoras disponibles.
- **Tamaño del papel**: 58 mm u 80 mm.
- **Vista previa**: revisa cómo quedará el ticket antes de imprimir.

### Personalización visual 🎨

Los **botones, fondos y textos son configurables**. Desde los ajustes puedes cambiar:

- Colores del encabezado y de los botones.
- Redondeo de los botones.
- Título que se muestra en pantalla.
- Imagen de fondo.
- Número de columnas del menú.

### Actualizaciones 🔄

La máquina puede actualizarse sola. En **Ajustes → Actualizaciones** puedes comprobar si hay una versión nueva en GitHub, descargarla e instalarla con un clic; la app se reinicia con la versión actualizada.

> ℹ️ La comprobación de actualizaciones solo está disponible en la app instalada.

### Preguntas frecuentes ❓

**¿La máquina funciona sin servidor?**
No. Necesita un servidor Keues desplegado y accesible desde la misma red que la máquina.

**¿Qué impresora necesito?**
Una impresora térmica POS (58/80 mm) o cualquier impresora del sistema. Se selecciona desde los ajustes.

**¿Puedo cambiar los colores y textos?**
Sí. Botones, fondos y textos son configurables desde los ajustes de la máquina.

**¿Cómo se actualiza la máquina?**
Desde **Ajustes → Actualizaciones** se comprueba, descarga e instala la última versión con un clic.

---

## Licencia

Distribuido bajo la [Licencia MIT](LICENSE).
