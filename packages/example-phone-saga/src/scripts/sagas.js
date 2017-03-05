import {saga as dialSaga} from './sagas/dial';

export default function* rootSaga() {
  yield [
    dialSaga()
  ];
}
