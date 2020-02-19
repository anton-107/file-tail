import {Duplex} from 'stream';
import {createReadStream, FSWatcher, ReadStream, watch, read} from 'fs';

export class FileTail {
    private outputStream = new Duplex({
        objectMode: true,
        read: () => {},
        write: this.outputStreamWrite.bind(this),
    });
    private isStarted = false;
    private isReading = false;
    private isSynced = false;

    private openFileDescriptor: number = undefined;
    private currentReadPosition = 0;
    private bytesRead = 0;
    private startPosition = 0;
    private watcher: FSWatcher = undefined;

    private readStream: ReadStream;
    constructor(private path: string, private encoding = 'utf8') {
        this.outputStream.on('close', this.onOutputStreamClose.bind(this));
        // this.outputStream.on('write', this.onOutputStreamWrite.bind(this));
    }

    public start(startPosition = 0) {
        if (this.isStarted) {
            return;
        }
        this.isStarted = true;
        this.startPosition = startPosition;

        this.readStream = createReadStream(this.path, {
            encoding: this.encoding,
            start: startPosition,
            autoClose: false,
        });

        this.readStream.once('open', this.onReadStreamOpen.bind(this));
        this.readStream.once('end', this.onReadStreamEnd.bind(this));
        this.readStream.pipe(this.outputStream, { end: false });
    }

    public onData(listener) {
        this.outputStream.on('data', listener);
    }

    private onReadStreamOpen(fd: number) {
        this.openFileDescriptor = fd;
        const chunkSize = this.readStream.readableHighWaterMark;
        this.watcher = watch(this.path, () => {
            if (!this.isReading && this.isSynced) {
                this.readChunk(chunkSize);
            }
        });
        
    }

    private onReadStreamEnd() {
        this.currentReadPosition = this.bytesRead + this.startPosition;
        this.isSynced = true;
    }

    private readChunk(chunkSize: number) {
        this.isReading = true;

        const buffer = Buffer.alloc(chunkSize);
        read(this.openFileDescriptor, buffer, 0, chunkSize, this.currentReadPosition, (err, bytesRead) => {
            if (err) throw err;
            if (bytesRead) {
                this.currentReadPosition += bytesRead;
                const data = buffer.slice(0, bytesRead).toString(this.encoding);
                this.outputStream.push(data);
                return setImmediate(() => this.readChunk(chunkSize));
            }
            if (this.isReading) {
                this.isReading = false;
                if (!this.watcher) {
                    this.outputStream.push(null);
                }
            }
        });
    }

    private outputStreamWrite(data) {
        this.bytesRead = Buffer.byteLength(data);
        this.outputStream.push(data);
    }
    
    private onOutputStreamClose() {
        if (this.watcher) {
            this.watcher.close();
            delete this.watcher;
        }
    }

}
