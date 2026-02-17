import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.join(__dirname, '../src/content/docs');
const DAYS_NEW = 7; // Días para considerar algo "Nuevo"

// Función recursiva para hallar archivos .mdx
function getFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const subdirs = fs.readdirSync(dir);
  const files = subdirs.map((subdir) => {
    const res = path.resolve(dir, subdir);
    return fs.statSync(res).isDirectory() ? getFiles(res) : res;
  });
  return files.reduce((a, f) => a.concat(f), []);
}

console.log('🚀 Iniciando script de badges (Improved)...');

try {
  console.log('📂 Directorio de contenido:', CONTENT_DIR);

  if (!fs.existsSync(CONTENT_DIR)) {
    console.error('❌ Directorio de contenido no encontrado:', CONTENT_DIR);
    process.exit(1);
  }

  const files = getFiles(CONTENT_DIR).filter(f => f.endsWith('.mdx'));
  console.log(`🔎 Encontrados ${files.length} archivos .mdx`);
  let updatedCount = 0;

  files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');

    // Extraer Frontmatter con soporte para CRLF y espacios extra
    const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
    if (!match) {
      // console.log(`⏩ Saltando (sin frontmatter): ${path.basename(file)}`);
      return;
    }

    const frontmatter = match[1];

    // Buscar fecha con regex más flexible (espacios opcionales, comillas opcionales)
    const dateMatch = frontmatter.match(/date:\s*["']?(\d{4}-\d{2}-\d{2})["']?/);
    if (!dateMatch) {
      // console.log(`⏩ Saltando (sin fecha): ${path.basename(file)}`);
      return;
    }

    const postDate = new Date(dateMatch[1]);
    const diffTime = new Date().getTime() - postDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const isNew = Math.abs(diffDays) <= DAYS_NEW;

    // console.log(`🔎 Scan: ${path.basename(file)} | Fecha: ${dateMatch[1]} | Diff: ${diffDays} días | Nuevo: ${isNew}`);

    let newFrontmatter = frontmatter;
    const hasSidebar = /sidebar:\s*(\r?\n|$)/.test(frontmatter);
    const hasBadge = /badge:\s*(\r?\n|$)/.test(frontmatter);
    const hasNewBadge = /text:\s*Nuevo/.test(frontmatter);

    if (isNew) {
      if (hasBadge && !hasNewBadge) {
        // Tiene un badge manual (no es Nuevo), lo respetamos
        return;
      }

      if (hasNewBadge) {
        // Ya tiene el badge correcto
        return;
      }

      // Insertar Badge de Nuevo
      const badgeYaml = `\n  badge:\n    text: Nuevo\n    variant: success`;

      if (hasSidebar) {
        // Inyectar badge justo debajo de "sidebar:"
        newFrontmatter = frontmatter.replace(/(sidebar:\s*(\r?\n|$))/, '$1  badge:\n    text: Nuevo\n    variant: success\n');
      } else {
        // Agregar sidebar al final si no existe
        newFrontmatter = frontmatter.trimEnd() + `\nsidebar:${badgeYaml}\n`;
      }

      console.log(`✨ Marcando como NUEVO: ${path.basename(file)} (${diffDays} días)`);
    } else {
      // Si NO es nuevo y tiene el badge "Nuevo", quitarlo (Limpieza)
      if (hasNewBadge) {
        // Buscar y eliminar el bloque del badge específico 'Nuevo'
        // Esto es un poco delicado con regex, pero intentaremos remover el bloque
        // Asume indentación de 2 espacios para badge y 4 para propiedades
        newFrontmatter = frontmatter.replace(/(\s*)badge:\s*\n\s+text:\s*Nuevo\s*\n\s+variant:\s*[a-z]+\s*(\n|$)/g, '');

        // Limpiar sidebar vacía si quedó huérfana (sidebar: seguido de nada o solo espacios/newlines hasta el final o siguiente propiedad raiz?)
        // Simplificación: si sidebar queda vacío (solo whitespace), quitarlo.
        // Pero sidebar podría tener 'order' u otras cosas.

        // Si sidebar solo tenía el badge y ahora está vacío:
        // Buscamos "sidebar:" seguido solo de whitespace (y opcionalmente comentarios)
        // Esto es complejo, por ahora dejemos el sidebar aunque esté vacío o con otras props.

        console.log(`🧹 Quitando etiqueta NUEVO: ${path.basename(file)}`);
      } else {
        return; // No es nuevo y no tiene badge nuevo -> nada que hacer
      }
    }

    if (newFrontmatter !== frontmatter) {
      const newContent = content.replace(frontmatter, newFrontmatter);
      fs.writeFileSync(file, newContent, 'utf8');
      updatedCount++;
    }
  });

  console.log(`✅ Proceso terminado. ${updatedCount} archivos actualizados.`);
} catch (error) {
  console.error('❌ Error fatal en auto-badges:', error);
  process.exit(1);
}
