const fs = require('fs'); // Node.js's built-in file system module
const path = require('path');

exports.getFileDate = (req, res) => {
    const dirPath = path.join(__dirname, '../seeders/import/processed');
    fs.readdir(dirPath, (err, files) => {
        if (err) return res.status(500).json({ error: 'Failed to read directory' });
        
        const filteredFiles = files.filter(file => file.endsWith('.csv'));
        const fileInfos = filteredFiles.map(file => {
            const filePath = path.join(dirPath, file);
            const stats = fs.statSync(filePath);
            const pad = n => n < 10 ? '0' + n : n;
            const formattedDate = `${stats.mtime.getFullYear()}-${pad(stats.mtime.getMonth() + 1)}-${pad(stats.mtime.getDate())} ${pad(stats.mtime.getHours())}:${pad(stats.mtime.getMinutes())}:${pad(stats.mtime.getSeconds())}.${stats.mtime.getMilliseconds()}`;
            return {
                file,
                mtime: stats.mtime,
                formattedDate
            };
        });

        fileInfos.sort((a, b) => b.mtime - a.mtime);

        const fileDates = fileInfos.map(info => ({
            fileName: info.file.replace(/\.csv$/i, ''),
            date: info.formattedDate
        }));

        res.json(fileDates);
    });
}