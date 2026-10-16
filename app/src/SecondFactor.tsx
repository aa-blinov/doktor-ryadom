import {AccountSettings} from './AccountSettings';
import {PageHead} from './ui';
import type {User} from './shared';

// Doctors and administrators cannot work until a second factor is on. The account page holds the setup.
export function SecondFactorPage({user}:{user:User}){
 return <section className="second-factor">
  <PageHead title="Включите вход с кодом" description="Для кабинета врача и администратора нужен второй фактор: код из приложения-аутентификатора. Настройте его здесь, затем кабинет откроется."/>
  <AccountSettings user={user}/>
 </section>;
}
