# FileTail
Turn an append-only file into a stream

## Usage
```
import {FileTail} from './file-tail';

const tail = new FileTail('test.log');
tail.start();

tail.onData(d => {
    console.log(d);
})
```
