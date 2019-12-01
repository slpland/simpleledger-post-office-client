import React, { Component } from 'react'
import PropTypes from 'prop-types'
import classnames from 'classnames'
import { Tabs, Tab } from '../../tabs'
import {
  ConfirmPageContainerSummary,
  ConfirmPageContainerError,
  ConfirmPageContainerWarning,
} from './'

export default class ConfirmPageContainerContent extends Component {
  static propTypes = {
    action: PropTypes.string,
    dataComponent: PropTypes.node,
    txParams: PropTypes.object,
    detailsComponent: PropTypes.node,
    errorKey: PropTypes.string,
    errorMessage: PropTypes.string,
    hideSubtitle: PropTypes.bool,
    identiconAddress: PropTypes.string,
    nonce: PropTypes.string,
    assetImage: PropTypes.string,
    subtitle: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    summaryComponent: PropTypes.node,
    title: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    titleComponent: PropTypes.func,
    warning: PropTypes.string,
  }

  renderContent () {
    // TODO: render details, fee and total
    // const { detailsComponent, dataComponent } = this.props
    // if (detailsComponent && dataComponent) {
    //   return this.renderTabs()
    // } else {
    //   return detailsComponent || dataComponent
    // }
  }

  renderOpReturn () {
    const {
      txParams,
    } = this.props

    if (!txParams.opReturn || !txParams.opReturn.data) {
      return null
    }

    const opReturnText = txParams.opReturn.data.join(' ')

    return (
      <div className="confirm-page-container-content__details">
        <br/>
        <div className={classnames('confirm-detail-row__header-text')}>
          OP Return
        </div>
        <div className="confirm-detail-row">
          <div>
            {opReturnText}
          </div>
        </div>
      </div>
    )
  }

  renderMemo () {
    const {
      txParams,
    } = this.props

    if (!txParams.paymentData || !txParams.paymentData.memo) {
      return null
    }

    const memoText = txParams.paymentData.memo

    return (
      <div className="confirm-page-container-content__details">
        <br/>
        <div className={classnames('confirm-detail-row__header-text')}>
          Memo
        </div>
        <div className="confirm-detail-row">
          <div>
            {memoText}
          </div>
        </div>
      </div>
    )
  }

  renderTabs () {
    const { detailsComponent, dataComponent } = this.props

    return (
      <Tabs>
        <Tab name="Details">{detailsComponent}</Tab>
        <Tab name="Data">{dataComponent}</Tab>
      </Tabs>
    )
  }

  render () {
    const {
      action,
      errorKey,
      errorMessage,
      title,
      subtitle,
      hideSubtitle,
      identiconAddress,
      nonce,
      assetImage,
      summaryComponent,
      detailsComponent,
      dataComponent,
      warning,
    } = this.props

    return (
      <div className="confirm-page-container-content">
        {warning && <ConfirmPageContainerWarning warning={warning} />}
        {summaryComponent || (
          <ConfirmPageContainerSummary
            className={classnames({
              'confirm-page-container-summary--border':
                !detailsComponent || !dataComponent,
            })}
            action={action}
            title={title}
            subtitle={subtitle}
            hideSubtitle={hideSubtitle}
            identiconAddress={identiconAddress}
            nonce={nonce}
            assetImage={assetImage}
          />
        )}
        {this.renderMemo()}
        {this.renderOpReturn()}
        {/* {this.renderContent()} */}
        {(errorKey || errorMessage) && (
          <div className="confirm-page-container-content__error-container">
            <ConfirmPageContainerError
              errorMessage={errorMessage}
              errorKey={errorKey}
            />
          </div>
        )}
      </div>
    )
  }
}
