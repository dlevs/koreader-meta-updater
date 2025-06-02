import * as fs from 'fs';
import * as path from 'path';

interface EpubFile {
  filename: string;
  fullPath: string;
  id: string;
}

interface SidecarDir {
  dirName: string;
  fullPath: string;
  id: string;
  metadataPath: string;
}

/**
 * Extract numerical ID from filename like "Book Title (123).epub" -> "123"
 */
function extractId(filename: string): string | null {
  const match = filename.match(/\((\d+)\)\.(?:epub|sdr)$/);
  return match?.[1] ?? null;
}

/**
 * Create a timestamped backup of the docsettings directory
 */
async function createBackup(docsettingsDir: string, verbose: boolean, dryRun: boolean): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), '.backups');
  const backupPath = path.join(backupDir, `docsettings-backup-${timestamp}`);

  if (dryRun) {
    console.log(`🔍 [DRY RUN] Would create backup at: ${backupPath}`);
    return;
  }

  if (verbose) {
    console.log(`📦 Creating backup at: ${backupPath}`);
  }

  // Ensure backup directory exists
  await fs.promises.mkdir(backupDir, { recursive: true });

  // Copy the entire docsettings directory
  await copyDirectory(docsettingsDir, backupPath);

  console.log(`✅ Backup created: ${backupPath}`);
}

/**
 * Recursively copy a directory
 */
async function copyDirectory(src: string, dest: string): Promise<void> {
  await fs.promises.mkdir(dest, { recursive: true });
  
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.promises.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Scan epub directory for epub files with IDs
 */
async function scanEpubFiles(epubDir: string, verbose: boolean): Promise<EpubFile[]> {
  const epubFiles: EpubFile[] = [];
  
  try {
    const files = await fs.promises.readdir(epubDir);
    
    for (const file of files) {
      if (file.endsWith('.epub')) {
        const id = extractId(file);
        if (id) {
          epubFiles.push({
            filename: file,
            fullPath: path.join(epubDir, file),
            id
          });
          
          if (verbose) {
            console.log(`📖 Found epub: ${file} (ID: ${id})`);
          }
        }
      }
    }
  } catch (error) {
    throw new Error(`Failed to scan epub directory: ${error}`);
  }
  
  return epubFiles;
}

/**
 * Recursively scan docsettings directory for .sdr directories with IDs
 */
async function scanSidecarDirs(docsettingsDir: string, verbose: boolean): Promise<SidecarDir[]> {
  const sidecarDirs: SidecarDir[] = [];
  
  async function scanRecursive(dir: string): Promise<void> {
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          if (entry.name.endsWith('.sdr')) {
            const id = extractId(entry.name);
            if (id) {
              const metadataPath = path.join(fullPath, 'metadata.epub.lua');
              
              // Check if metadata file exists
              if (fs.existsSync(metadataPath)) {
                sidecarDirs.push({
                  dirName: entry.name,
                  fullPath,
                  id,
                  metadataPath
                });
                
                if (verbose) {
                  console.log(`📁 Found sidecar: ${entry.name} (ID: ${id})`);
                }
              }
            }
          } else {
            // Recursively scan subdirectories
            await scanRecursive(fullPath);
          }
        }
      }
    } catch (error) {
      if (verbose) {
        console.warn(`Warning: Could not scan directory ${dir}: ${error}`);
      }
    }
  }
  
  await scanRecursive(docsettingsDir);
  return sidecarDirs;
}

/**
 * Update the doc_path in metadata.epub.lua file
 */
async function updateMetadataDocPath(metadataPath: string, newDocPath: string, verbose: boolean, dryRun: boolean): Promise<void> {
  try {
    const content = await fs.promises.readFile(metadataPath, 'utf8');
    
    // Use regex to find and replace the doc_path line
    const docPathRegex = /(\["doc_path"\]\s*=\s*")([^"]+)(")/;
    const match = content.match(docPathRegex);
    
    if (match && match[2] !== newDocPath) {
      const oldPath = match[2];
      
      if (dryRun) {
        console.log(`  🔍 [DRY RUN] Would update doc_path from: ${oldPath}`);
        console.log(`  🔍 [DRY RUN] Would update doc_path to: ${newDocPath}`);
        return;
      }
      
      const updatedContent = content.replace(docPathRegex, `$1${newDocPath}$3`);
      await fs.promises.writeFile(metadataPath, updatedContent, 'utf8');
      
      if (verbose) {
        console.log(`  📝 Updated doc_path from: ${oldPath}`);
        console.log(`  📝 Updated doc_path to: ${newDocPath}`);
      }
    } else if (verbose || dryRun) {
      console.log(`  ✓ doc_path already correct: ${newDocPath}`);
    }
  } catch (error) {
    throw new Error(`Failed to update metadata file ${metadataPath}: ${error}`);
  }
}

/**
 * Generate new filename without prefix and with proper naming
 */
function generateNewFilename(epubFilename: string): string {
  // Remove any leading path-like prefixes (e.g., "Non-Fiction - ")
  let cleanName = epubFilename;
  
  // If there's a " - " pattern that looks like a category prefix, remove it
  const prefixMatch = cleanName.match(/^[^-]+ - (.+)$/);
  if (prefixMatch?.[1]) {
    cleanName = prefixMatch[1];
  }
  
  return cleanName;
}

/**
 * Main function to fix KOReader metadata
 */
export async function fixKoReaderMetadata(epubDir: string, docsettingsDir: string, verbose: boolean = false, dryRun: boolean = false): Promise<void> {
  console.log('🔍 Scanning directories...');
  
  // Step 1: Create backup (skip in dry-run mode)
  await createBackup(docsettingsDir, verbose, dryRun);
  
  // Step 2: Scan for epub files and sidecar directories
  const epubFiles = await scanEpubFiles(epubDir, verbose);
  const sidecarDirs = await scanSidecarDirs(docsettingsDir, verbose);
  
  console.log(`\n📊 Found ${epubFiles.length} epub files and ${sidecarDirs.length} sidecar directories`);
  
  if (epubFiles.length === 0) {
    console.log('⚠️  No epub files with IDs found in the epub directory');
    return;
  }
  
  if (sidecarDirs.length === 0) {
    console.log('⚠️  No sidecar directories with IDs found in the docsettings directory');
    return;
  }
  
  // Step 3: Match and update
  let updatedCount = 0;
  let wouldUpdateCount = 0;
  
  for (const sidecar of sidecarDirs) {
    const matchingEpub = epubFiles.find(epub => epub.id === sidecar.id);
    
    if (matchingEpub) {
      const currentSidecarName = sidecar.dirName.replace('.sdr', '');
      const cleanedEpubName = generateNewFilename(matchingEpub.filename).replace('.epub', '');
      
      console.log(`\n🔄 Processing ID ${sidecar.id}:`);
      console.log(`  📖 Current epub: ${matchingEpub.filename}`);
      console.log(`  📁 Current sidecar: ${sidecar.dirName}`);
      
      let needsUpdate = false;
      let wouldNeedUpdate = false;
      
      // Check if sidecar directory name needs updating to match cleaned epub name
      if (currentSidecarName !== cleanedEpubName) {
        const newSidecarName = `${cleanedEpubName}.sdr`;
        
        if (dryRun) {
          console.log(`  🔍 [DRY RUN] Would rename sidecar directory: ${sidecar.dirName} → ${newSidecarName}`);
          wouldNeedUpdate = true;
        } else {
          const newSidecarPath = path.join(path.dirname(sidecar.fullPath), newSidecarName);
          console.log(`  🔄 Renaming sidecar directory: ${sidecar.dirName} → ${newSidecarName}`);
          
          try {
            await fs.promises.rename(sidecar.fullPath, newSidecarPath);
            sidecar.fullPath = newSidecarPath;
            sidecar.metadataPath = path.join(newSidecarPath, 'metadata.epub.lua');
            needsUpdate = true;
          } catch (error) {
            console.error(`  ❌ Failed to rename sidecar directory: ${error}`);
            continue;
          }
        }
      }
      
      // Always check/update doc_path to match current epub location
      const newDocPath = matchingEpub.fullPath;
      await updateMetadataDocPath(sidecar.metadataPath, newDocPath, verbose, dryRun);
      
      if (!dryRun) {
        needsUpdate = true;
      } else {
        wouldNeedUpdate = true;
      }
      
      if (dryRun && wouldNeedUpdate) {
        wouldUpdateCount++;
        console.log(`  🔍 [DRY RUN] Would be updated`);
      } else if (needsUpdate) {
        updatedCount++;
        console.log(`  ✅ Updated`);
      } else {
        console.log(`  ✅ Already up to date`);
      }
    } else {
      if (verbose) {
        console.log(`⚠️  No matching epub found for sidecar ID ${sidecar.id}: ${sidecar.dirName}`);
      }
    }
  }
  
  if (dryRun) {
    console.log(`\n📈 Summary: Would update ${wouldUpdateCount} sidecar files`);
    if (wouldUpdateCount > 0) {
      console.log(`💡 Run without --dry-run to make these changes`);
    }
  } else {
    console.log(`\n📈 Summary: Updated ${updatedCount} sidecar files`);
  }
} 
