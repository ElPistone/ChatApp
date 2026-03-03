const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const {GridFsStorage} = require('multer-gridfs-storage');
const crypto = require('crypto');
const path = require('path');
const auth = require('../middleware/auth');

// Configuration du stockage GridFS
const storage = new GridFsStorage({
    url: process.env.MONGODB_URI,
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(16, (err, buf) => {
                if (err) {
                    return reject(err);
                }
                
                // Créer un nom de fichier unique
                const filename = buf.toString('hex') + path.extname(file.originalname);
                
                // Définir les métadonnées du fichier
                const fileInfo = {
                    filename: filename,
                    bucketName: 'uploads',
                    metadata: {
                        originalName: file.originalname,
                        uploader: req.user.userId,
                        mimeType: file.mimetype
                    }
                };
                resolve(fileInfo);
            });
        });
    }
});

const upload = multer({ storage });

// Route pour uploader un fichier
router.post('/upload', auth, upload.single('file'), (req, res) => {
    try {
        res.json({
            message: 'Fichier uploadé avec succès',
            file: {
                id: req.file.id,
                filename: req.file.filename,
                originalName: req.file.originalname,
                size: req.file.size,
                mimeType: req.file.mimetype
            }
        });
    } catch (error) {
        console.error('Erreur upload:', error);
        res.status(500).json({ message: 'Erreur lors de l\'upload' });
    }
});

// Route pour télécharger un fichier
router.get('/download/:fileId', auth, async (req, res) => {
    try {
        const conn = mongoose.connection;
        const gfs = new mongoose.mongo.GridFSBucket(conn.db, {
            bucketName: 'uploads'
        });

        const fileId = new mongoose.Types.ObjectId(req.params.fileId);
        
        // Vérifier si le fichier existe
        const files = await conn.db.collection('uploads.files').find({ _id: fileId }).toArray();
        
        if (!files || files.length === 0) {
            return res.status(404).json({ message: 'Fichier non trouvé' });
        }

        // Configurer les headers pour le téléchargement
        res.set('Content-Type', files[0].contentType);
        res.set('Content-Disposition', `attachment; filename="${files[0].metadata.originalName}"`);

        // Stream le fichier vers le client
        const downloadStream = gfs.openDownloadStream(fileId);
        downloadStream.pipe(res);

    } catch (error) {
        console.error('Erreur téléchargement:', error);
        res.status(500).json({ message: 'Erreur lors du téléchargement' });
    }
});

// Route pour avoir les infos d'un fichier
router.get('/info/:fileId', auth, async (req, res) => {
    try {
        const conn = mongoose.connection;
        const fileId = new mongoose.Types.ObjectId(req.params.fileId);
        
        const files = await conn.db.collection('uploads.files').find({ _id: fileId }).toArray();
        
        if (!files || files.length === 0) {
            return res.status(404).json({ message: 'Fichier non trouvé' });
        }

        res.json({
            id: files[0]._id,
            filename: files[0].filename,
            originalName: files[0].metadata.originalName,
            size: files[0].length,
            mimeType: files[0].metadata.mimeType,
            uploadDate: files[0].uploadDate
        });

    } catch (error) {
        console.error('Erreur info fichier:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération des infos' });
    }
});

module.exports = router;