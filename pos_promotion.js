/** @odoo-module */

import {Order} from "@point_of_sale/app/store/models";
import {patch} from "@web/core/utils/patch";
import {Orderline} from "@point_of_sale/app/store/models";
import {jsonrpc} from "@web/core/network/rpc_service";

// patch(Order.prototype, {
//     add_orderline(line) {
//         console.log(line, 'line')
//         console.log(this, 'line')
//         return super.add_orderline(...arguments);
//     },
// });

patch(Orderline.prototype, {
    setup(_defaultObj, options) {
        super.setup(...arguments);
        this.promotionId = options.promotionId
    }, set_quantity(quantity, keep_price) {
        let self = this;
        if (self.order !== null && !self.promotionId) {
            jsonrpc('/web/dataset/call_kw', {
                model: 'pos.promotions',
                method: 'search_read',
                args: [[], ['id', 'name', 'qty', 'price', 'product_ids', 'pos_config_ids', 'state', 'disc_product']],
                kwargs: {},
            }).then(function (pos_promotions) {
                    for (var promotion of pos_promotions) {
                        if (self.order !== null && !self.promotionId) {

                            var orderlines = self.order.orderlines
                            if (self.order && !promotion['pos_config_ids'] || promotion['pos_config_ids'].includes(self.order.pos.config.id) && promotion['state'] === "running") {
                                var orderlines_has_same_products = orderlines.filter(line => promotion['product_ids'] && promotion['product_ids'].includes(line.product.id));
                                console.log(orderlines_has_same_products)
                                var promotion_price = promotion['price']
                                var promotion_qty = promotion['qty']
                                var required_qty = orderlines_has_same_products.map(line => line.quantity).reduce((accumulator, currentValue) => accumulator + currentValue, 0);
                                var duplicate_qty = Math.floor(required_qty / promotion['qty']) * promotion['qty'] >= promotion_qty ? Math.floor(required_qty / promotion['qty']) * promotion['qty'] : promotion_qty
                                var qty = Math.floor(required_qty / promotion['qty']) * promotion['qty'] >= promotion_qty ? Math.floor(required_qty / promotion['qty']) * promotion['qty'] : promotion_qty
                                var total_disc = 0;
                                if (qty > 0 && required_qty >= promotion_qty) {
                                    for (var line of orderlines_has_same_products) {
                                        var line_price = (line.get_price_with_tax() / line.quantity).toFixed(2);
                                        if (qty > 0) {
                                            for (var i = 1; i <= line.quantity && qty > 0; i++) {
                                                qty -= 1
                                                console.log(line, i, qty, line_price)
                                                total_disc += parseFloat(line_price)
                                            }

                                        }
                                    }
                                } else {
                                    orderlines.filter(line => line.promotionId === promotion['id'])
                                    self.order.orderlines = self.order.orderlines.filter(line => line.promotionId !== promotion['id'])
                                }

                                total_disc = total_disc - (promotion_price * (duplicate_qty / promotion_qty))
                                var line_to_delete = self.order.orderlines.filter(line => line.promotionId === promotion['id'] && line.price !== -total_disc)
                                if (line_to_delete.length > 0) {
                                    let indexToRemove = self.order.orderlines.indexOf(line_to_delete[0]);

                                    if (indexToRemove !== -1) {
                                        self.order.orderlines.splice(indexToRemove, 1);
                                    }
                                }

                                var product = self.pos.db.get_product_by_id(promotion['disc_product'][0])
                                if (qty === 0 && product !== undefined && orderlines && orderlines.filter(line => line.promotionId === promotion['id']).length === 0) {
                                    var line_values = {
                                        pos: self.pos,
                                        order: self.order,
                                        product: product,
                                        price: -total_disc,
                                        tax_ids: undefined,
                                        price_manually_set: true,
                                        promotionId: promotion['id'],
                                    };
                                    var new_line = new Orderline({env: self.env}, line_values);
                                    self.order.add_orderline(new_line);

                                }
                            }
                        }
                    }
                }
            )
            ;
        }
        return super.set_quantity(...arguments);
    }
    ,
});

