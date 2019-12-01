import React, { PureComponent } from 'react'
import PropTypes from 'prop-types'
import classnames from 'classnames'
import Tooltip from '../tooltip-v2'
import {
  UNAPPROVED_STATUS,
  REJECTED_STATUS,
  APPROVED_STATUS,
  SIGNED_STATUS,
  SUBMITTED_STATUS,
  CONFIRMED_STATUS,
  FAILED_STATUS,
  DROPPED_STATUS,
} from '../../constants/transactions'

const statusToClassNameHash = {
  [UNAPPROVED_STATUS]: 'transaction-status--unapproved',
  [REJECTED_STATUS]: 'transaction-status--rejected',
  [APPROVED_STATUS]: 'transaction-status--approved',
  [SIGNED_STATUS]: 'transaction-status--signed',
  [SUBMITTED_STATUS]: 'transaction-status--submitted',
  [CONFIRMED_STATUS]: 'transaction-status--confirmed',
  [FAILED_STATUS]: 'transaction-status--failed',
  [DROPPED_STATUS]: 'transaction-status--dropped',
}

const statusToTextHash = {
  [APPROVED_STATUS]: 'pending',
  [SUBMITTED_STATUS]: 'pending',
}

export default class TransactionStatus extends PureComponent {
  static defaultProps = {
    title: null,
  }

  static contextTypes = {
    t: PropTypes.func,
  }

  static propTypes = {
    statusKey: PropTypes.string,
    className: PropTypes.string,
    title: PropTypes.string,
  }

  render () {
    const { className, statusKey, title, transaction } = this.props
    let statusText = this.context.t(statusToTextHash[statusKey] || statusKey)

    return (
      <div
        className={classnames(
          'transaction-status',
          className,
          statusToClassNameHash[statusKey]
        )}
      >
        <Tooltip position="top" title={title}>
          {statusText}
        </Tooltip>
      </div>
    )
  }
}
