import chalk from 'chalk';

/**
 * Main logger function.
 * @param {string} data    - Message to log.
 * @param {string} [option] - Label / severity ('warn' | 'error' | any label string).
 */
export default function logger(data, option = '[ INFO ]') {
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });

  switch (option?.toLowerCase()) {
    case 'warn':
      console.log(chalk.bold.yellow(`[${timestamp}] [ WARN ] »`) + ' ' + data);
      break;
    case 'error':
      console.log(chalk.bold.red(`[${timestamp}] [ ERROR ] »`) + ' ' + data);
      break;
    default:
      console.log(chalk.bold.cyan(`[${timestamp}] ${option} »`) + ' ' + data);
  }
}

/**
 * Loader-style logger (used during module loading).
 */
logger.loader = function (data, option) {
  switch (option?.toLowerCase()) {
    case 'warn':
      console.log(chalk.bold.yellow('[ LOADER ] »') + ' ' + data);
      break;
    case 'error':
      console.log(chalk.bold.red('[ LOADER ] »') + ' ' + data);
      break;
    default:
      console.log(chalk.bold.magenta('[ LOADER ] »') + ' ' + data);
  }
};